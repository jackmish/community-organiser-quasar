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
    const target = new Date(day);

    if (cycle === 'dayWeek') {
      const dow = target.getDay();
      const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const key = map[dow];
      const days = getRepeatDays(task);
      return days.indexOf(key) !== -1;
    }

    if (cycle === 'month') {
      const evDate =
        task?.repeat?.eventDate ?? task?.repeat?.date ?? task.eventDate ?? task.date ?? null;
      if (!evDate) return false;
      const seed = new Date(evDate);
      return seed.getDate() === target.getDate();
    }

    if (cycle === 'year') {
      const evDate =
        task?.repeat?.eventDate ?? task?.repeat?.date ?? task.eventDate ?? task.date ?? null;
      if (!evDate) return false;
      const seed = new Date(evDate);
      return seed.getDate() === target.getDate() && seed.getMonth() === target.getMonth();
    }

    // Interval-based cycles (stored as 'other') use an interval in days
    if (cycle === 'other') {
      const evDate =
        task?.repeat?.eventDate ?? task?.repeat?.date ?? task.eventDate ?? task.date ?? null;
      if (!evDate) return false;
      const seed = new Date(evDate);
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

  // Not cyclic: falls back to one-time match by date
  return (task.date || task.eventDate) === day;
}
