import { lanHttpRequest } from 'src/modules/lan/lanHttp';
import { isAiServerBridgeAvailable } from './aiServerService';
import { loadAiServerBaseUrl } from './aiServerSettings';

export type Co21ApiRequestOptions = {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  baseUrl?: string;
  timeoutMs?: number;
};

export type Co21ApiResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  rawBody: string;
};

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/api/v1/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function co21ApiRequest<T = unknown>(
  options: Co21ApiRequestOptions,
): Promise<Co21ApiResponse<T>> {
  const base = String(options.baseUrl || (await loadAiServerBaseUrl())).replace(/\/$/, '');
  const url = `${base}${normalizePath(options.path)}`;
  const method = (options.method || 'GET').toUpperCase();
  const allowed = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
  const httpMethod = allowed.has(method) ? method : 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  if (isAiServerBridgeAvailable()) {
    try {
      const lanOpts: {
        url: string;
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
        headers?: Record<string, string>;
        body?: string;
        timeoutMs: number;
      } = {
        url,
        method: httpMethod as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS',
        headers,
        timeoutMs: options.timeoutMs ?? 20_000,
      };
      if (body !== undefined) lanOpts.body = body;
      const res = await lanHttpRequest(lanOpts);
      let data: T | null = null;
      if (res.body) {
        try {
          data = JSON.parse(res.body) as T;
        } catch {
          data = null;
        }
      }
      return { ok: res.ok, status: res.status, data, rawBody: res.body };
    } catch {
      return { ok: false, status: 0, data: null, rawBody: '' };
    }
  }

  try {
    const init: RequestInit = { method: httpMethod, headers };
    if (body !== undefined) init.body = body;
    const res = await fetch(url, init);
    const rawBody = await res.text();
    let data: T | null = null;
    if (rawBody) {
      try {
        data = JSON.parse(rawBody) as T;
      } catch {
        data = null;
      }
    }
    return { ok: res.ok, status: res.status, data, rawBody };
  } catch {
    return { ok: false, status: 0, data: null, rawBody: '' };
  }
}

export async function co21ApiHealth(baseUrl?: string): Promise<boolean> {
  const resolvedBase = baseUrl || (await loadAiServerBaseUrl());
  const res = await co21ApiRequest<{ status?: string }>({
    path: '/api/v1/health',
    baseUrl: resolvedBase,
    timeoutMs: 5000,
  });
  return res.ok;
}
