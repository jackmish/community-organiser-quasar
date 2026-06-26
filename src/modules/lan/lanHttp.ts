import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { HttpOptions } from '@capacitor/core';
import logger from 'src/utils/logger';
import {
  pushLanHttpDebugFinish,
  pushLanHttpDebugStart,
} from './lanDebugLog';

export type LanHttpResponse = {
  status: number;
  body: string;
  ok: boolean;
};

export class LanHttpError extends Error {
  status: number;
  body: string;

  constructor(message: string, status = 0, body = '') {
    super(message);
    this.name = 'LanHttpError';
    this.status = status;
    this.body = body;
  }
}

type LanTransport = 'capacitor-native' | 'electron-ipc' | 'fetch';

function pickLanTransport(): LanTransport {
  if (Capacitor.isNativePlatform()) return 'capacitor-native';
  const eLan = (window as { electronLan?: { httpRequest?: unknown } }).electronLan;
  if (typeof eLan?.httpRequest === 'function') return 'electron-ipc';
  return 'fetch';
}

function httpResponseDataToBody(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data == null) return '';
  if (typeof data === 'number' && Number.isFinite(data)) return String(data);
  if (typeof data === 'boolean') return data ? 'true' : 'false';
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data);
    } catch {
      return '';
    }
  }
  return '';
}

function raceAbort<T>(
  signal: AbortSignal | undefined,
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(new LanHttpError('Pairing cancelled', 0, ''));
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new LanHttpError(`Connection timed out (${Math.round(timeoutMs / 1000)}s)`, 0, ''));
    }, timeoutMs);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new LanHttpError('Pairing cancelled', 0, ''));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    promise
      .then((v) => {
        window.clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(v);
      })
      .catch((e: unknown) => {
        window.clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(
          e instanceof Error
            ? e
            : new LanHttpError(typeof e === 'string' ? e : 'Request failed', 0, ''),
        );
      });
  });
}

/**
 * Native HTTP (OkHttp on Android). Bypasses WebView mixed-content block on http://LAN.
 * Chrome browser works; https://localhost WebView cannot call http://192.168.x.x via XHR.
 */
async function capacitorLanRequest(opts: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<LanHttpResponse> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  const httpOpts: HttpOptions = {
    url: opts.url,
    method: opts.method,
    headers,
    connectTimeout: opts.timeoutMs,
    readTimeout: opts.timeoutMs,
    responseType: 'text',
  };
  if (opts.body !== undefined) {
    httpOpts.data = opts.body;
  }

  try {
    const res = await raceAbort(opts.signal, CapacitorHttp.request(httpOpts), opts.timeoutMs);
    const body = httpResponseDataToBody(res.data);
    const status = res.status ?? 0;
    return {
      status,
      body,
      ok: status >= 200 && status < 300,
    };
  } catch (e: unknown) {
    if (e instanceof LanHttpError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('[lanHttp] CapacitorHttp error', opts.method, opts.url, msg);
    throw new LanHttpError(msg, 0, '');
  }
}

/**
 * Node.js HTTP via Electron IPC — bypasses Chromium CORS/preflight entirely.
 */
async function electronIpcLanRequest(opts: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<LanHttpResponse> {
  if (opts.signal?.aborted) {
    throw new LanHttpError('Pairing cancelled', 0, '');
  }
  const eLan = (window as { electronLan?: { httpRequest: (o: unknown) => Promise<LanHttpResponse> } }).electronLan;
  if (!eLan) {
    throw new LanHttpError('electronLan not available', 0, '');
  }
  const res = await raceAbort(
    opts.signal,
    eLan.httpRequest({
      url: opts.url,
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      timeoutMs: opts.timeoutMs,
    }),
    opts.timeoutMs,
  );
  if (!res.ok && res.status === 0) {
    throw new LanHttpError('Network error (Node.js)', 0, '');
  }
  return res;
}

/**
 * HTTP for LAN APIs. Native Capacitor HTTP on Android/iOS;
 * Node.js via IPC on Electron; fetch on web.
 */
export async function lanHttpRequest(opts: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<LanHttpResponse> {
  const transport = pickLanTransport();
  const logId = pushLanHttpDebugStart({
    method: opts.method,
    url: opts.url,
    transport,
    timeoutMs: opts.timeoutMs,
    ...(opts.headers ? { headers: opts.headers } : {}),
    ...(opts.body !== undefined ? { body: opts.body } : {}),
  });
  const started = Date.now();
  const finish = (partial: { status: number; body: string; error?: string }) => {
    pushLanHttpDebugFinish(logId, {
      durationMs: Date.now() - started,
      status: partial.status,
      body: partial.body,
      ...(partial.error ? { error: partial.error } : {}),
    });
  };
  try {
    let res: LanHttpResponse;
    if (transport === 'capacitor-native') {
      res = await capacitorLanRequest(opts);
    } else if (transport === 'electron-ipc') {
      res = await electronIpcLanRequest(opts);
    } else {
      res = await fetchLanRequest(opts);
    }
    finish({ status: res.status, body: res.body });
    return res;
  } catch (e: unknown) {
    const status = e instanceof LanHttpError ? e.status : 0;
    const body = e instanceof LanHttpError ? e.body : '';
    const msg = e instanceof Error ? e.message : String(e);
    finish({ status, body, error: msg });
    throw e;
  }
}

async function fetchLanRequest(opts: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<LanHttpResponse> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), opts.timeoutMs);
  if (opts.signal?.aborted) {
    window.clearTimeout(timer);
    throw new LanHttpError('Pairing cancelled', 0, '');
  }
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const init: RequestInit = { method: opts.method, signal: controller.signal };
    if (opts.headers) init.headers = opts.headers;
    if (opts.body !== undefined) init.body = opts.body;
    const res = await fetch(opts.url, init);
    const body = await res.text();
    return { status: res.status, body, ok: res.ok };
  } catch (e: unknown) {
    if (controller.signal.aborted && !opts.signal?.aborted) {
      throw new LanHttpError(
        `Connection timed out (${Math.round(opts.timeoutMs / 1000)}s)`,
        0,
        '',
      );
    }
    if (e instanceof LanHttpError) throw e;
    throw new LanHttpError(
      e instanceof Error ? e.message : String(e),
      0,
      '',
    );
  } finally {
    window.clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
