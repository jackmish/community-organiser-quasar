import { CO21_LAN_API_PREFIX } from './lanPairingConstants';
import type { LanSyncExchangeRequest, LanSyncExchangeResponse } from './lanSyncAuth';
import { lanHttpRequest } from './lanHttp';
import logger from 'src/utils/logger';

/** POST sync exchange — caller sends device id + token + delta; contract terms are local on both sides. */
export async function lanPostSyncExchange(
  baseUrl: string,
  body: LanSyncExchangeRequest,
  timeoutMs = 20_000,
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
    if (!res.ok || !res.body.trim()) {
      logger.warn('[lanSyncTransport] exchange failed', res.status, res.body?.slice(0, 200));
      return null;
    }
    return JSON.parse(res.body) as LanSyncExchangeResponse;
  } catch (e) {
    logger.warn('[lanSyncTransport] exchange error', e instanceof Error ? e.message : e);
    return null;
  }
}
