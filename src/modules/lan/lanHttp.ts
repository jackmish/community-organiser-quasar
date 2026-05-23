import { Capacitor } from '@capacitor/core';
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

/**
 * HTTP for LAN APIs. On Android uses XMLHttpRequest (WebView fetch often fails for
 * http://192.168.x.x even with cleartext permitted).
 */
export async function lanHttpRequest(opts: {
  url: string;
  method: 'GET' | 'POST' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<LanHttpResponse> {
  const transport = Capacitor.getPlatform() === 'android' ? 'xhr' : 'fetch';
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
    const res =
      transport === 'xhr' ? await xhrLanRequest(opts) : await fetchLanRequest(opts);
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
  method: 'GET' | 'POST' | 'OPTIONS';
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

function xhrLanRequest(opts: {
  url: string;
  method: 'GET' | 'POST' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<LanHttpResponse> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new LanHttpError('Pairing cancelled', 0, ''));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url, true);
    xhr.timeout = opts.timeoutMs;
    const headers = { ...opts.headers };
    if (opts.body && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    for (const [k, v] of Object.entries(headers)) {
      if (v) xhr.setRequestHeader(k, v);
    }
    const finishAbort = () => {
      try {
        xhr.abort();
      } catch {
        void 0;
      }
      reject(new LanHttpError('Pairing cancelled', 0, xhr.responseText ?? ''));
    };
    if (opts.signal) opts.signal.addEventListener('abort', finishAbort, { once: true });

    const snapshot = (): { status: number; body: string } => ({
      status: xhr.status || 0,
      body: xhr.responseText ?? '',
    });

    xhr.onload = () => {
      opts.signal?.removeEventListener('abort', finishAbort);
      const { status, body } = snapshot();
      resolve({
        status,
        body,
        ok: status >= 200 && status < 300,
      });
    };
    xhr.onerror = () => {
      opts.signal?.removeEventListener('abort', finishAbort);
      const { status, body } = snapshot();
      logger.warn('[lanHttp] XHR error', opts.method, opts.url, status);
      reject(
        new LanHttpError(
          `Network error calling ${opts.url} (status ${status || 0})`,
          status,
          body,
        ),
      );
    };
    xhr.ontimeout = () => {
      opts.signal?.removeEventListener('abort', finishAbort);
      const { status, body } = snapshot();
      reject(
        new LanHttpError(
          `Connection timed out (${Math.round(opts.timeoutMs / 1000)}s)`,
          status,
          body,
        ),
      );
    };
    try {
      xhr.send(opts.body ?? null);
    } catch (e: unknown) {
      opts.signal?.removeEventListener('abort', finishAbort);
      const { status, body } = snapshot();
      reject(
        e instanceof LanHttpError
          ? e
          : new LanHttpError(e instanceof Error ? e.message : String(e), status, body),
      );
    }
  });
}
