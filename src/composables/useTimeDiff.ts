import { timeDiffClassFor } from 'src/components/theme';

function normalizeToMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDate(input?: string | Date | null): Date | null {
  if (input == null || input === '') return null;
  const dt = input instanceof Date ? input : new Date(String(input));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatRelativeDays(daysDiff: number): string {
  if (daysDiff === 0) return 'TODAY';
  if (daysDiff === 1) return 'TOMORROW';
  if (daysDiff === -1) return 'YESTERDAY';

  if (daysDiff > 0) {
    const weeks = Math.floor(daysDiff / 7);
    if (weeks >= 1) {
      const rem = daysDiff % 7;
      if (rem > 0)
        return `In ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ${rem} ${rem === 1 ? 'day' : 'days'}`;
      return `In ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    }
    return `In ${daysDiff} ${daysDiff === 1 ? 'day' : 'days'}`;
  }

  const abs = Math.abs(daysDiff);
  const weeks = Math.floor(abs / 7);
  if (weeks >= 1) {
    const rem = abs % 7;
    if (rem > 0)
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ${rem} ${rem === 1 ? 'day' : 'days'} ago`;
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  return `${abs} ${abs === 1 ? 'day' : 'days'} ago`;
}

export function useTimeDiff() {
  const getTimeDifferenceDisplay = (dayDate?: string | Date | null) => {
    const d = toDate(dayDate);
    if (!d) return 'Select a date';

    const dateMid = normalizeToMidnight(d);
    const todayMid = normalizeToMidnight(new Date());

    const daysDiff = Math.floor((dateMid.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
    return formatRelativeDays(daysDiff);
  };

  const getTimeDiffClass = (dayDate?: string | Date | null) =>
    timeDiffClassFor(getTimeDifferenceDisplay(dayDate));

  return { getTimeDifferenceDisplay, getTimeDiffClass } as const;
}
