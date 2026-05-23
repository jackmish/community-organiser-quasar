/** Pick a LAN host suitable for storing on a device row (never loopback). */

/** Strip port / IPv6 prefix so `192.168.1.10:47321` and `::ffff:192.168.1.10` work. */
export function normalizeLanHostCandidate(raw: string): string {
  let h = String(raw || '').trim();
  if (h.startsWith('::ffff:')) h = h.slice(7);
  const noScheme = h.replace(/^https?:\/\//i, '');
  const hostPart = (noScheme.split('/')[0] ?? '').trim();
  const colonIdx = hostPart.indexOf(':');
  if (colonIdx > 0) {
    const maybeIp = hostPart.slice(0, colonIdx);
    const maybePort = hostPart.slice(colonIdx + 1);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(maybeIp) && /^\d+$/.test(maybePort)) {
      return maybeIp;
    }
  }
  return hostPart;
}

export function isUsableLanHost(host: string): boolean {
  const h = normalizeLanHostCandidate(host).toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return false;
  if (h.startsWith('127.')) return false;
  return true;
}

export function pickReachableLanHost(candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const raw = normalizeLanHostCandidate(String(c || ''));
    if (!raw) continue;
    if (isUsableLanHost(raw)) return raw;
  }
  return '';
}

export function parseLanReachableAddresses(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((s) => isUsableLanHost(s));
}
