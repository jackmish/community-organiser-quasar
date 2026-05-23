/** Fixed LAN port for CO21 pairing (same on PC and expected by mobile). */
export const CO21_LAN_PAIRING_PORT = 47321;

/** Bonjour / mDNS type segment → `_co21-organiser._tcp` on the LAN. */
export const CO21_MDNS_SERVICE_TYPE = 'co21-organiser';

export const CO21_LAN_API_PREFIX = '/co21-lan/v1';

export const CO21_LAN_INFO_PATH = `${CO21_LAN_API_PREFIX}/info`;

/**
 * Normalize request path (trailing slash, short `/info` alias).
 * Used by Electron/Android LAN servers and diagnostics.
 */
export function normalizeLanApiPath(urlOrPath: string): string {
  let p = String(urlOrPath || '/').split('?')[0]?.trim() || '/';
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  if (p === '/info') return CO21_LAN_INFO_PATH;
  return p;
}

/** Normalize stored `lanHost` before {@link co21LanBaseUrl}. */
export function normalizeLanHostInput(host: string): string {
  let h = String(host || '').trim();
  if (h.startsWith('::ffff:')) h = h.slice(7);
  const infoSuffix = `${CO21_LAN_API_PREFIX}/info`;
  if (h.includes(infoSuffix)) {
    h = h.replace(infoSuffix, '').replace(/\/+$/, '');
  }
  return h;
}

/** Build `http://host:port` for LAN pairing API calls. */
export function co21LanBaseUrl(host: string, port = CO21_LAN_PAIRING_PORT): string {
  const raw = normalizeLanHostInput(host);
  if (!raw) return '';
  // Bare IPv6 (multiple ":") — not valid as host:port without brackets
  if (
    !raw.startsWith('[') &&
    !/^https?:\/\//i.test(raw) &&
    (raw.match(/:/g)?.length ?? 0) > 1
  ) {
    return `http://[${raw}]:${port}`;
  }
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

/** Hostname / IPv4 keys used to match incoming LAN HTTP client address. */
export function lanHostMatchKeys(host: string): string[] {
  const raw = normalizeLanHostInput(host);
  if (!raw) return [];
  const keys: string[] = [];
  const push = (s: string) => {
    const k = s.trim().toLowerCase();
    if (k) keys.push(k);
  };
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      push(u.hostname);
    } catch {
      void 0;
    }
  }
  const colonIdx = raw.indexOf(':');
  const hostPart = (colonIdx > 0 ? raw.slice(0, colonIdx) : raw).split('/')[0] ?? '';
  push(hostPart);
  return [...new Set(keys)];
}
