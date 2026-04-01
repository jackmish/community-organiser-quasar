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
 * Clamps the day component of a YYYY-MM-DD string to the last valid day of
 * that month/year.  Returns the original value unchanged when it is already
 * valid or cannot be parsed.
 *
 * Example: '2026-02-30' → '2026-02-28', '2026-06-31' → '2026-06-30'
 */
export function clampDateToMonth(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = Number(parts[0]);
  const m = Number(parts[1]); // 1-based
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) return dateStr;
  // new Date(y, m, 0) gives the last day of month m (1-based)
  const lastDay = new Date(y, m, 0).getDate();
  if (d >= 1 && d <= lastDay) return dateStr; // already valid
  const clamped = String(Math.max(1, Math.min(d, lastDay))).padStart(2, '0');
  return `${parts[0]}-${parts[1]}-${clamped}`;
}

/**
 * Scans a `days` map (Record<string, { date: string; tasks: any[]; notes: string }>)
 * and fixes any out-of-range day dates in-place.
 *
 * - Normalises the `date`/`eventDate` fields on every task.
 * - If a day *key* itself is out of range, the tasks are moved to the corrected
 *   key (merging with any tasks already there).
 *
 * Returns the number of date values that were changed.
 */
export function fixInvalidDatesInDays(days: Record<string, any>): number {
  if (!days || typeof days !== 'object') return 0;
  let fixes = 0;

  // First pass: fix task-level date fields in-place
  for (const key of Object.keys(days)) {
    const day = days[key];
    if (!day || !Array.isArray(day.tasks)) continue;
    for (const task of day.tasks) {
      if (!task) continue;
      for (const field of ['date', 'eventDate'] as const) {
        const raw: string | undefined = task[field];
        if (!raw) continue;
        const fixed = clampDateToMonth(raw);
        if (fixed !== raw) {
          task[field] = fixed;
          fixes++;
        }
      }
    }
    // Fix the day's own `date` property
    if (day.date) {
      const fixed = clampDateToMonth(day.date);
      if (fixed !== day.date) {
        day.date = fixed;
        fixes++;
      }
    }
  }

  // Second pass: move tasks from invalid day keys to their corrected key
  for (const key of Object.keys(days)) {
    const fixed = clampDateToMonth(key);
    if (fixed === key || !fixed) continue;
    // Key itself is out of range — migrate its tasks
    const srcDay = days[key];
    if (!srcDay) continue;
    if (!days[fixed]) {
      days[fixed] = { date: fixed, tasks: [], notes: srcDay.notes ?? '' };
    }
    const srcTasks: any[] = Array.isArray(srcDay.tasks) ? srcDay.tasks : [];
    const destTasks: any[] = Array.isArray(days[fixed].tasks) ? days[fixed].tasks : [];
    for (const task of srcTasks) {
      if (!destTasks.some((t) => String(t.id) === String(task.id))) {
        destTasks.push(task);
      }
    }
    days[fixed].tasks = destTasks;
    delete days[key];
    fixes++;
  }

  return fixes;
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
