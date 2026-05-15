import { $text, getLocale, hasText } from './index';

/** Sunday = 0 … Saturday = 6 (matches Date#getDay). */
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

function weekdayTextKey(date: Date, style: 'long' | 'short'): string {
  const key = WEEKDAY_KEYS[date.getDay()] ?? 'sun';
  return style === 'short' ? `date.weekday.${key}_short` : `date.weekday.${key}`;
}

function monthTextKey(date: Date, style: 'long' | 'short'): string {
  const key = MONTH_KEYS[date.getMonth()] ?? 'jan';
  return style === 'short' ? `date.month.${key}_short` : `date.month.${key}`;
}

/**
 * Weekday name using app translations when available (required on Android WebView
 * where Intl often ignores `pl` and falls back to English).
 */
export function formatAppWeekday(date: Date, style: 'long' | 'short' = 'long'): string {
  const textKey = weekdayTextKey(date, style);
  if (hasText(textKey)) return $text(textKey);
  return new Intl.DateTimeFormat(getLocale(), { weekday: style }).format(date);
}

export function formatAppMonthLong(date: Date): string {
  const textKey = monthTextKey(date, 'long');
  if (hasText(textKey)) return $text(textKey);
  return new Intl.DateTimeFormat(getLocale(), { month: 'long' }).format(date);
}

export function formatAppMonthShort(date: Date): string {
  const textKey = monthTextKey(date, 'short');
  if (hasText(textKey)) return $text(textKey).replace(/\./g, '');
  return new Intl.DateTimeFormat(getLocale(), { month: 'short' }).format(date).replace(/\./g, '');
}
