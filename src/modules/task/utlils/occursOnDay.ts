import { format } from 'date-fns';

// Local YYYY-MM-DD parser to avoid timezone shifts when creating Dates
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

export function formatDisplayDate(date: string) {
  try {
    const parsed = parseYmdLocal(date);
    if (parsed) return format(parsed, 'EEEE, dd.MM.yyyy');
    return format(new Date(date), 'EEEE, dd.MM.yyyy');
  } catch (e) {
    return date || '';
  }
}

export function formatEventHoursDiff(dateStr: string, timeStr: string, now = new Date()) {
  if (!dateStr || !timeStr) return '';
  // Build the event Date using local YMD parsing to avoid timezone shifts
  const seed = parseYmdLocal(dateStr) || new Date(dateStr);
  if (!seed || isNaN(seed.getTime())) return '';
  const timeParts = String(timeStr)
    .split(':')
    .map((p) => Number(p));
  const hh = Number.isFinite(timeParts[0]) ? timeParts[0] : 0;
  const mm = Number.isFinite(timeParts[1]) ? timeParts[1] : 0;
  const ss = Number.isFinite(timeParts[2]) ? timeParts[2] : 0;
  const dt = new Date(seed.getFullYear(), seed.getMonth(), seed.getDate(), hh, mm, ss, 0);
  const diffMinutes = Math.round((dt.getTime() - now.getTime()) / (1000 * 60));
  const sign = diffMinutes >= 0 ? 1 : -1;
  const absMinutes = Math.abs(diffMinutes);
  const days = Math.floor(absMinutes / (60 * 24));
  const remAfterDays = absMinutes - days * 24 * 60;
  const hours = Math.floor(remAfterDays / 60);
  const minutes = remAfterDays % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  const str = parts.join(' ');
  return sign >= 0 ? `In ${str}` : `${str} ago`;
}

export function getCycleType(task: any): string | null {
  if (!task) return null;
  if (task.repeat == null) return null;

  // Prefer canonical `repeat` object when present (non-null)

  return (task.repeat.cycleType ?? task.repeat.cycle_type ?? 'dayWeek') as string;
}

export function getRepeatDays(task: any) {
  if (Array.isArray(task?.repeat?.days)) return task.repeat.days;
  return Array.isArray(task.repeatDays)
    ? task.repeatDays
    : Array.isArray(task.repeat_days)
      ? task.repeat_days
      : [];
}

export function occursOnDay(task: any, day: string): boolean {
  if (!task) return false;

  const cycle = getCycleType(task);
  if (cycle) {
    const target = parseYmdLocal(day) || new Date(day);

    if (cycle === 'dayWeek') {
      const dow = target.getDay();
      const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const key = map[dow];
      const days = getRepeatDays(task) || [];
      // Normalize repeat day values to three-letter lowercase keys
      const normalize = (v: any): string | null => {
        if (v == null) return null;
        const s = String(v).toLowerCase().trim();
        const fullMap: Record<string, string> = {
          sunday: 'sun',
          monday: 'mon',
          tuesday: 'tue',
          wednesday: 'wed',
          thursday: 'thu',
          friday: 'fri',
          saturday: 'sat',
        };
        if (fullMap[s]) return fullMap[s];
        if (s.length >= 3) {
          const short = s.slice(0, 3);
          if (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(short)) return short;
        }
        // numeric day (0=Sun..6=Sat)
        if (/^[0-6]$/.test(s)) {
          const idx = Number(s);
          const mapNum = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
          return mapNum[idx]!;
        }
        return null;
      };
      const normalized = days
        .map(normalize)
        .filter((x: string | null | undefined): x is string => x !== null && x !== undefined);
      return normalized.indexOf(key) !== -1;
    }

    if (cycle === 'month') {
      const evDate =
        task?.repeat?.eventDate ?? task?.repeat?.date ?? task.eventDate ?? task.date ?? null;
      if (!evDate) return false;
      const seed = parseYmdLocal(evDate) || new Date(evDate);
      // If the seed specifies a day that doesn't exist in the target month
      // (e.g. 31st) treat the occurrence as the last day of the target month.
      const desiredDay = seed.getDate();
      const year = target.getFullYear();
      const month = target.getMonth();
      const daysInTargetMonth = new Date(year, month + 1, 0).getDate();
      const effectiveDay = Math.min(desiredDay, daysInTargetMonth);
      return effectiveDay === target.getDate();
    }

    if (cycle === 'year') {
      const evDate =
        task?.repeat?.eventDate ?? task?.repeat?.date ?? task.eventDate ?? task.date ?? null;
      if (!evDate) return false;
      const seed = parseYmdLocal(evDate) || new Date(evDate);
      return seed.getDate() === target.getDate() && seed.getMonth() === target.getMonth();
    }

    // Interval-based cycles (stored as 'other') use an interval in days
    if (cycle === 'other') {
      const evDate =
        task?.repeat?.eventDate ?? task?.repeat?.date ?? task.eventDate ?? task.date ?? null;
      if (!evDate) return false;
      const seed = parseYmdLocal(evDate) || new Date(evDate);
      const rawInterval =
        Number(
          task?.repeat?.intervalDays ??
            task?.repeat?.interval_days ??
            task.intervalDays ??
            task.interval_days ??
            0,
        ) || 0;
      const interval = Math.max(0, Math.floor(rawInterval));
      if (interval <= 0) return false;

      // Calculate full-day difference between target and seed
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffDays = Math.floor((target.getTime() - seed.getTime()) / msPerDay);
      if (diffDays < 0) return false; // occurrences start at seed and go forward
      return diffDays % interval === 0;
    }

    return false;
  }

  // Not cyclic: falls back to one-time match by date. If `date`/`eventDate` is
  // missing, use the task's creation timestamp (`createdAt` / `created_at`) and
  // compare only the YYYY-MM-DD portion so ISO datetimes still match.
  const ev = task.date ?? task.eventDate ?? task.createdAt ?? task.created_at ?? null;
  if (!ev) return false;
  if (ev instanceof Date) {
    const y = ev.getFullYear();
    const m = String(ev.getMonth() + 1).padStart(2, '0');
    const d = String(ev.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}` === day;
  }
  if (typeof ev === 'string') {
    const datePart = ev.indexOf('T') !== -1 ? ev.split('T')[0] : ev;
    return datePart === day;
  }
  return false;
}
