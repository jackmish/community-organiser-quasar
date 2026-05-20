/** Fixed LAN port for CO21 pairing (same on PC and expected by mobile). */
export const CO21_LAN_PAIRING_PORT = 47321;

/** Bonjour / mDNS type segment → `_co21-organiser._tcp` on the LAN. */
export const CO21_MDNS_SERVICE_TYPE = 'co21-organiser';

export const CO21_LAN_API_PREFIX = '/co21-lan/v1';

/** Build `http://host:port` for LAN pairing API calls. */
export function co21LanBaseUrl(host: string, port = CO21_LAN_PAIRING_PORT): string {
  const raw = String(host || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (!u.port) u.port = String(port);
      return u.origin;
    } catch {
      return '';
    }
  }
  if (raw.startsWith('[')) {
    return `http://${raw}:${port}`;
  }
  // host:port without scheme (e.g. from QR caption or manual paste)
  const colonIdx = raw.indexOf(':');
  if (colonIdx > 0) {
    const hostPart = raw.slice(0, colonIdx);
    const portPart = raw.slice(colonIdx + 1).split('/')[0] ?? '';
    if (hostPart && /^\d+$/.test(portPart)) {
      return `http://${hostPart}:${portPart}`;
    }
  }
  return `http://${raw}:${port}`;
}
