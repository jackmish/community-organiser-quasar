import { CO21_LAN_API_PREFIX } from './lanPairingConstants';
import type { LanSyncExchangeRequest, LanSyncExchangeResponse } from './lanSyncAuth';

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** POST sync exchange — caller sends device id + token + delta; contract terms are local on both sides. */
export async function lanPostSyncExchange(
  baseUrl: string,
  body: LanSyncExchangeRequest,
  timeoutMs = 8_000,
): Promise<LanSyncExchangeResponse | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/sync/exchange`;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
    if (!res.ok) return null;
    return (await res.json()) as LanSyncExchangeResponse;
  } catch {
    return null;
  }
}
