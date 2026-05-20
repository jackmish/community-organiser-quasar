import { CO21_LAN_PAIRING_PORT, co21LanBaseUrl } from './lanPairingConstants';

/** What we encode in a pairing QR: base URL for the LAN pairing HTTP API. */
export function buildLanPairingQrPayload(host: string, port = CO21_LAN_PAIRING_PORT): string {
  return co21LanBaseUrl(host.trim(), port);
}

/**
 * Turn QR text into a value suitable for {@link co21LanBaseUrl} / PC host field.
 * Accepts: full `http(s)://…` URL, JSON `{"u":"http://…"}`, JSON `{"host":"ip"}`, or plain host/IP.
 */
export function parseHostFromLanQrContent(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    if (t.startsWith('{')) {
      const j = JSON.parse(t) as Record<string, unknown>;
      if (typeof j.u === 'string') return parseHostFromLanQrContent(j.u);
      if (typeof j.url === 'string') return parseHostFromLanQrContent(j.url);
      if (typeof j.host === 'string') {
        const h = j.host.trim();
        if (h) {
          const firstSeg = h.split('/')[0] ?? h;
          const hostPart = firstSeg.split(':')[0] ?? firstSeg;
          return hostPart.trim() || h;
        }
      }
    }
  } catch {
    /* not JSON */
  }
  try {
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t);
      const h = u.hostname;
      return h || null;
    }
  } catch {
    /* bad URL */
  }
  const oneLine = t.split(/\s/)[0] ?? t;
  const noPath = oneLine.split('/')[0] ?? oneLine;
  const hostPort = noPath.split(':');
  const hostOnly = (hostPort[0] ?? '').trim();
  if (!hostOnly) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return hostOnly;
  if (/^[a-zA-Z0-9.-]+$/.test(hostOnly)) return hostOnly;
  return null;
}
