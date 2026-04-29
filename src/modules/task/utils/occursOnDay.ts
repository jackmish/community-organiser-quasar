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

/**
 * Day-of-month (1–31) from a YYYY-MM-DD string as written, without `Date` overflow.
 * e.g. `2025-04-31` → 31 (monthly "nth" intent); `Date` would roll to May 1 instead.
 */
export function dayOfMonthFromYmdString(s: string | undefined | null): number | null {
  if (!s || typeof s !== 'string') return null;
  const datePart = (s.indexOf('T') !== -1 ? (s.split('T')[0] ?? s) : s).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return null;
  const d = Number(m[3]);
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  return d;
}

/** Calendar month 1–12 from YYYY-MM-DD as written (same string rules as dayOfMonthFromYmdString). */
export function monthFromYmdString(s: string | undefined | null): number | null {
  if (!s || typeof s !== 'string') return null;
  const datePart = (s.indexOf('T') !== -1 ? (s.split('T')[0] ?? s) : s).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return null;
  const mo = Number(m[2]);
  if (!Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  return mo;
}

export function formatDisplayDate(date: string) {
  try {
    const parsed = parseYmdLocal(date) || (date ? new Date(date) : null);
    if (!parsed || isNaN(parsed.getTime())) return date || '';
    // Prefer a relative label for dates that are near (Today/Tomorrow)
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const evMid = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.round((evMid.getTime() - todayMid.getTime()) / msPerDay);
    if (diffDays === 0) return `TODAY, ${format(parsed, 'dd.MM.yyyy')}`;
    if (diffDays === 1) return `TOMORROW, ${format(parsed, 'dd.MM.yyyy')}`;
    return format(parsed, 'EEEE, dd.MM.yyyy');
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

  // An empty repeat object {} has no cycleType → treat as non-cyclic (null).
  // Previously this fell back to 'dayWeek' which caused tasks with repeat:{}
  // to be permanently filtered out (cyclic with no days = never occurs).
  const cycleType = task.repeat.cycleType ?? task.repeat.cycle_type ?? null;
  return cycleType as string | null;
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
      const evPart =
        typeof evDate === 'string' && evDate.indexOf('T') !== -1 ? evDate.split('T')[0] : evDate;
      const seed =
        (typeof evPart === 'string' ? parseYmdLocal(evPart) : null) ||
        (evPart instanceof Date ? evPart : new Date(String(evPart)));
      if (!seed || isNaN(seed.getTime())) return false;
      // Prefer the written DD in YYYY-MM-DD so values like 2025-04-31 keep intent 31;
      // parseYmdLocal / Date overflow would turn that into the 1st of the next month.
      const fromString = typeof evPart === 'string' ? dayOfMonthFromYmdString(evPart) : null;
      const desiredDay = fromString ?? seed.getDate();
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
      const evPart =
        typeof evDate === 'string' && evDate.indexOf('T') !== -1 ? evDate.split('T')[0] : evDate;
      const seed =
        (typeof evPart === 'string' ? parseYmdLocal(evPart) : null) ||
        (evPart instanceof Date ? evPart : new Date(String(evPart)));
      if (!seed || isNaN(seed.getTime())) return false;
      const fromStringDay =
        typeof evPart === 'string' ? dayOfMonthFromYmdString(evPart) : null;
      const fromStringMonth =
        typeof evPart === 'string' ? monthFromYmdString(evPart) : null;
      const desiredDay = fromStringDay ?? seed.getDate();
      const desiredMonth = fromStringMonth ?? seed.getMonth() + 1;
      const y = target.getFullYear();
      const m = target.getMonth();
      if (m + 1 !== desiredMonth) return false;
      const daysInTargetMonth = new Date(y, m + 1, 0).getDate();
      const effectiveDay = Math.min(desiredDay, daysInTargetMonth);
      return effectiveDay === target.getDate();
    }

    // Interval-based cycles (stored as 'other') use an interval in days
    if (cycle === 'other') {
      const evDate =
        task?.repeat?.eventDate ?? task?.repeat?.date ?? task.eventDate ?? task.date ?? null;
      if (!evDate) return false;
      const evPart =
        typeof evDate === 'string' && evDate.indexOf('T') !== -1 ? evDate.split('T')[0] : evDate;
      const seed =
        (typeof evPart === 'string' ? parseYmdLocal(evPart) : null) ||
        (evPart instanceof Date ? evPart : new Date(String(evPart)));
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
