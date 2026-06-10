import { timeDiffClassFor } from 'src/components/theme';
import { $text, getLanguage } from 'src/modules/lang';
import { formatAppWeekday } from 'src/modules/lang/dateFormat';
import { parseYmdLocal } from 'src/utils/dateUtils';

export type SchedulePhraseResult = {
  /** Main text without the day-count suffix. */
  lead: string;
  /** (+N days) / (N days ago) — always rendered last in labels. */
  daysSuffix: string;
  /** When true, lead already contains the compact calendar date. */
  embedsDate: boolean;
  /** lead + daysSuffix (suffix always at the end). */
  phrase: string;
};

function normalizeToMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDate(input?: string | Date | null): Date | null {
  if (input == null || input === '') return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return input;
  }
  const fromYmd = parseYmdLocal(String(input));
  if (fromYmd) return fromYmd;
  const dt = new Date(String(input));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(String(val));
  }
  return result;
}

function calendarDaysDiff(target: Date): number {
  const dateMid = normalizeToMidnight(target);
  const todayMid = normalizeToMidnight(new Date());
  return Math.floor((dateMid.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCompactDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  if (getLanguage() === 'pl') return `${dd}.${mm}.${yyyy}r.`;
  return `${dd}.${mm}.${yyyy}`;
}

function formatOnDateLead(targetDate: Date): string {
  const weekday = formatAppWeekday(targetDate, 'long');
  const date = formatCompactDate(targetDate);
  return fillTemplate($text('date.schedule.on_date_lead'), { weekday, date });
}

function formatInWeeksPhrase(weekday: string, weeks: number): string {
  if (weeks === 1) {
    return fillTemplate($text('date.schedule.on_weekday_in_1_week'), { weekday });
  }
  return fillTemplate($text('date.schedule.on_weekday_in_n_weeks'), { weekday, weeks });
}

function futureDaysSuffix(days: number): string {
  return fillTemplate($text('date.schedule.days_suffix_future'), { days });
}

function pastDaysSuffix(days: number): string {
  return fillTemplate($text('date.schedule.days_suffix_past'), { days });
}

function resolveDaysSuffix(daysDiff: number): string {
  if (daysDiff === 0 || daysDiff === 1 || daysDiff === -1) return '';
  if (daysDiff > 1) return futureDaysSuffix(daysDiff);
  return pastDaysSuffix(Math.abs(daysDiff));
}

function packScheduleResult(
  lead: string,
  daysDiff: number,
  embedsDate: boolean,
): SchedulePhraseResult {
  const daysSuffix = resolveDaysSuffix(daysDiff);
  const phrase = daysSuffix ? `${lead} ${daysSuffix}` : lead;
  return { lead, daysSuffix, embedsDate, phrase };
}

function buildFutureSchedulePhrase(daysDiff: number, targetDate: Date): SchedulePhraseResult {
  const weekday = formatAppWeekday(targetDate, 'long');

  if (daysDiff === 0) {
    return packScheduleResult($text('ui.today'), daysDiff, false);
  }
  if (daysDiff === 1) {
    return packScheduleResult($text('ui.tomorrow'), daysDiff, false);
  }
  if (daysDiff >= 2 && daysDiff <= 6) {
    return packScheduleResult(
      fillTemplate($text('date.relative.this_weekday'), { weekday }),
      daysDiff,
      false,
    );
  }
  if (daysDiff >= 7 && daysDiff <= 13) {
    return packScheduleResult(formatInWeeksPhrase(weekday, 1), daysDiff, false);
  }
  if (daysDiff === 14) {
    return packScheduleResult(formatInWeeksPhrase(weekday, 2), daysDiff, false);
  }
  if (daysDiff >= 15 && daysDiff <= 20) {
    return packScheduleResult(formatOnDateLead(targetDate), daysDiff, true);
  }
  if (daysDiff === 21) {
    return packScheduleResult(formatInWeeksPhrase(weekday, 3), daysDiff, false);
  }
  if (daysDiff >= 22 && daysDiff <= 27) {
    return packScheduleResult(formatOnDateLead(targetDate), daysDiff, true);
  }
  if (daysDiff === 28) {
    return packScheduleResult(formatInWeeksPhrase(weekday, 4), daysDiff, false);
  }
  return packScheduleResult(formatOnDateLead(targetDate), daysDiff, true);
}

function buildPastSchedulePhrase(daysDiff: number, targetDate: Date): SchedulePhraseResult {
  const weekday = formatAppWeekday(targetDate, 'long');
  const abs = Math.abs(daysDiff);
  if (abs < 7) {
    return packScheduleResult(
      fillTemplate($text('date.relative.past_weekday'), { weekday }),
      daysDiff,
      false,
    );
  }
  return packScheduleResult(formatOnDateLead(targetDate), daysDiff, true);
}

/** Relative schedule phrase for event labels and hints. */
export function formatSchedulePhraseWithMeta(
  dayDate?: string | Date | null,
): SchedulePhraseResult {
  const d = toDate(dayDate);
  if (!d) return { lead: '', daysSuffix: '', embedsDate: false, phrase: '' };

  const daysDiff = calendarDaysDiff(d);
  if (daysDiff >= 0) return buildFutureSchedulePhrase(daysDiff, d);
  return buildPastSchedulePhrase(daysDiff, d);
}

/** Weekday phrase for schedule placeholders (no embedded calendar date). */
export function formatScheduleWeekdayPhrase(dayDate?: string | Date | null): string {
  return formatSchedulePhraseWithMeta(dayDate).phrase;
}

function formatRelativeDays(daysDiff: number, targetDate: Date): string {
  return formatSchedulePhraseWithMeta(targetDate).phrase;
}

export function useTimeDiff() {
  const getTimeDifferenceDisplay = (dayDate?: string | Date | null) => {
    const d = toDate(dayDate);
    if (!d) return $text('date.select_date');
    return formatRelativeDays(calendarDaysDiff(d), d);
  };

  const getTimeDiffClass = (dayDate?: string | Date | null) => {
    const d = toDate(dayDate);
    if (!d) return 'time-diff-default';
    const daysDiff = calendarDaysDiff(d);
    if (daysDiff === 0) return 'time-diff-white';
    if (daysDiff === 1) return 'time-diff-lightblue';
    return timeDiffClassFor('');
  };

  return {
    getTimeDifferenceDisplay,
    getTimeDiffClass,
    formatScheduleWeekdayPhrase,
    formatSchedulePhraseWithMeta,
  } as const;
}
