import { shallowRef } from 'vue';
import { Capacitor } from '@capacitor/core';

export type LanDebugEntryKind = 'http' | 'event';

export type LanDebugEntry = {
  id: string;
  at: number;
  kind: LanDebugEntryKind;
  /** Short label (e.g. GET /info, probe summary). */
  title: string;
  method?: string;
  url?: string;
  transport?: 'capacitor-native' | 'xhr' | 'fetch';
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  status?: number;
  responseBody?: string;
  ok?: boolean;
  durationMs?: number;
  error?: string;
  /** NETWORK, TIMEOUT, HTTP_404, etc. */
  errorCode?: string;
  detail?: string;
  /** false while request is in flight */
  finished?: boolean;
};

const MAX_ENTRIES = 100;
let seq = 0;
/** Runtime override (boot / debug dialog) when compile-time env is missing on APK. */
let forceCapture = false;

export const lanDebugEntries = shallowRef<LanDebugEntry[]>([]);

export function setLanDebugForceCapture(on: boolean): void {
  forceCapture = on;
}

function envLanDebugFlag(): string {
  return String(import.meta.env.CO21_LAN_DEBUG ?? '');
}

/** Whether the Debug tools UI should show the LAN log section. */
export function isCo21LanDebugEnabled(): boolean {
  return isLanDebugCaptureActive();
}

/** Whether to record HTTP / probe events into the in-app log. */
export function isLanDebugCaptureActive(): boolean {
  if (forceCapture) return true;
  if (import.meta.env.DEV) return true;
  const flag = envLanDebugFlag();
  if (flag === '1') return true;
  /** Native debug APK if env was not injected (common on Capacitor). */
  if (Capacitor.isNativePlatform() && flag !== '0') return true;
  return false;
}

export function getLanDebugBuildInfo(): string {
  const flag = envLanDebugFlag() || '(unset)';
  return `capture=${isLanDebugCaptureActive() ? 'on' : 'off'} · CO21_LAN_DEBUG=${flag} · ${Capacitor.getPlatform()}`;
}

export function clearLanDebugLog(): void {
  lanDebugEntries.value = [];
}

function pushEntry(entry: Omit<LanDebugEntry, 'id' | 'at'>): string {
  if (!isLanDebugCaptureActive()) return '';
  const row: LanDebugEntry = {
    id: String(++seq),
    at: Date.now(),
    ...entry,
  };
  const next = [row, ...lanDebugEntries.value];
  if (next.length > MAX_ENTRIES) next.length = MAX_ENTRIES;
  lanDebugEntries.value = next;
  return row.id;
}

export function lanDebugNote(
  title: string,
  detail?: string,
  extra?: Partial<LanDebugEntry>,
): void {
  void pushEntry({
    kind: 'event',
    title,
    ...(detail ? { detail } : {}),
    ...extra,
  });
}

export function truncateLanDebugText(raw: string, max = 12_000): string {
  const s = raw.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated ${s.length - max} chars]`;
}

export function formatLanDebugJson(raw: string): string {
  if (!raw.trim()) return '(empty)';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function lanDebugPlatformHint(): string {
  const platform = Capacitor.getPlatform();
  const transport = Capacitor.isNativePlatform()
    ? 'CapacitorHttp (native)'
    : 'fetch';
  return `${platform} · ${transport}`;
}

function lanHttpPathFromUrl(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/i, '') || url;
}

function deriveLanHttpErrorCode(status: number, error?: string): string {
  const err = (error || '').toLowerCase();
  if (err.includes('timed out') || err.includes('timeout')) return 'TIMEOUT';
  if (err.includes('cancelled') || err.includes('canceled')) return 'CANCELLED';
  if (status === 0) return 'NETWORK';
  if (status >= 400) return `HTTP_${status}`;
  if (status > 0) return `HTTP_${status}`;
  return 'UNKNOWN';
}

export function pushLanHttpDebugStart(opts: {
  method: string;
  url: string;
  transport: 'capacitor-native' | 'xhr' | 'fetch';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
}): string {
  const path = lanHttpPathFromUrl(opts.url);
  const hasPayload = opts.method !== 'GET' && opts.method !== 'OPTIONS';
  return pushEntry({
    kind: 'http',
    title: `${opts.method} ${path}`,
    method: opts.method,
    url: opts.url,
    transport: opts.transport,
    finished: false,
    ...(opts.headers ? { requestHeaders: { ...opts.headers } } : {}),
    ...(hasPayload
      ? { requestBody: truncateLanDebugText(opts.body ?? '') }
      : {}),
    detail: `timeout ${opts.timeoutMs}ms`,
  });
}

export function pushLanHttpDebugFinish(
  id: string,
  result: {
    durationMs: number;
    status: number;
    body: string;
    error?: string;
  },
): void {
  if (!isLanDebugCaptureActive() || !id) return;
  const list = lanDebugEntries.value;
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const prev = list[idx];
  if (!prev) return;

  const status = Number.isFinite(result.status) ? result.status : 0;
  const httpOk = status >= 200 && status < 300 && !result.error;
  const errorCode = deriveLanHttpErrorCode(status, result.error);
  const path = prev.url ? lanHttpPathFromUrl(prev.url) : prev.title;
  const responseText = result.body.trim();
  const updated: LanDebugEntry = {
    ...prev,
    finished: true,
    durationMs: result.durationMs,
    ok: httpOk,
    status,
    errorCode,
    responseBody: responseText
      ? truncateLanDebugText(result.body)
      : result.error
        ? '(no response body)'
        : '(empty)',
    ...(result.error ? { error: result.error } : {}),
    title: httpOk
      ? `${prev.method ?? 'HTTP'} ${status} ${path}`
      : `FAIL ${status || errorCode} ${prev.method ?? ''} ${path}`.trim(),
  };
  const next = [...list];
  next[idx] = updated;
  lanDebugEntries.value = next;
}
