/**
 * dateUtils.ts
 *
 * Shared date helpers used across the task and UI layers.
 * No Vue/Pinia/Quasar dependencies — safe to use anywhere.
 */

/**
 * Parses a YYYY-MM-DD string into a local Date (no UTC offset shift).
 * Returns null for invalid or missing input.
 */
export function parseYmdLocal(s: string | undefined | null): Date | null {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-');
  if (parts.length < 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

/**
 * Returns today's date as a YYYY-MM-DD string in local time.
 */
export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Extracts the YYYY-MM-DD date part from a full ISO string or returns
 * the value unchanged if it is already a date-only string.
 */
export function toDateString(value: string): string {
  return value.indexOf('T') !== -1 ? value.split('T')[0]! : value;
}

/**
 * Returns the number of time-offset days declared on a task.
 * Reads `timeOffsetDays` (and legacy aliases). Returns 0 for missing/invalid.
 */
export function getTimeOffsetDaysForTask(t: any): number {
  const raw = t && (t.timeOffsetDays ?? t.time_offset_days ?? t.timeOffset ?? t.time_offset);
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = Number(raw);
  return isNaN(n) ? 0 : Math.max(0, Math.floor(n));
}
