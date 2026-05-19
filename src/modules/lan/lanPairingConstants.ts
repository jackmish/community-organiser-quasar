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
  return `http://${raw}:${port}`;
}
