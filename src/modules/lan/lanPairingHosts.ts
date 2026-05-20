/** Pick a LAN host suitable for storing on a device row (never loopback). */

export function isUsableLanHost(host: string): boolean {
  const h = String(host || '').trim().toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return false;
  if (h.startsWith('127.')) return false;
  return true;
}

export function pickReachableLanHost(candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const raw = String(c || '').trim();
    if (!raw) continue;
    if (isUsableLanHost(raw)) return raw;
    const stripped = raw.replace(/^::ffff:/i, '');
    if (isUsableLanHost(stripped)) return stripped;
  }
  return '';
}

export function parseLanReachableAddresses(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((s) => isUsableLanHost(s));
}
