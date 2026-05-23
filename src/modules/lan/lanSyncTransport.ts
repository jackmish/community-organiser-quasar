import { CO21_LAN_API_PREFIX } from './lanPairingConstants';
import type { LanSyncExchangeRequest, LanSyncExchangeResponse } from './lanSyncAuth';
import { lanHttpRequest } from './lanHttp';

/** POST sync exchange — caller sends device id + token + delta; contract terms are local on both sides. */
export async function lanPostSyncExchange(
  baseUrl: string,
  body: LanSyncExchangeRequest,
  timeoutMs = 8_000,
): Promise<LanSyncExchangeResponse | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/sync/exchange`;
  try {
    const res = await lanHttpRequest({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs,
    });
    if (!res.ok || !res.body.trim()) return null;
    return JSON.parse(res.body) as LanSyncExchangeResponse;
  } catch {
    return null;
  }
}
