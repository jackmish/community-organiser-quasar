import { parseLanReachableAddresses } from './lanPairingHosts';

/** Capacitor native events may wrap fields or send arrays as indexed objects. */
export function normalizeLanListenerDetail(ev: unknown): Record<string, unknown> {
  if (!ev || typeof ev !== 'object') return {};
  const o = ev as Record<string, unknown>;
  if (o.value && typeof o.value === 'object' && !Array.isArray(o.value)) {
    return o.value as Record<string, unknown>;
  }
  if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) {
    return o.data as Record<string, unknown>;
  }
  return o;
}

/** Parse LAN address lists from JS arrays, JSON strings, or Capacitor map objects. */
export function parseCapacitorStringArray(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return parseLanReachableAddresses(raw);
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      return parseCapacitorStringArray(JSON.parse(s) as unknown);
    } catch {
      return parseLanReachableAddresses([s]);
    }
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o);
    const numeric = keys.every((k) => /^\d+$/.test(k));
    if (numeric && keys.length) {
      const vals = keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => (typeof o[k] === 'string' ? o[k].trim() : ''))
        .filter((s) => s.length > 0);
      return parseLanReachableAddresses(vals);
    }
  }
  return [];
}

/** Deep-parse JSON string fields often flattened by native bridges (e.g. snapshot). */
export function parseCapacitorJsonField<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return null;
}
