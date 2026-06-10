import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useTimeDiff,
  formatScheduleWeekdayPhrase,
  formatSchedulePhraseWithMeta,
} from '../../src/composables/useTimeDiff';

vi.mock('src/modules/lang', () => ({
  getLanguage: () => 'en',
  $text: (key: string) => {
    const map: Record<string, string> = {
      'ui.today': 'TODAY',
      'ui.tomorrow': 'TOMORROW',
      'ui.yesterday': 'YESTERDAY',
      'date.select_date': 'Select a date',
      'date.relative.this_weekday': 'this {weekday}',
      'date.relative.past_weekday': 'last {weekday}',
      'date.schedule.on_weekday_in_1_week': 'on {weekday} in 1 week',
      'date.schedule.on_weekday_in_n_weeks': 'on {weekday} in {weeks} weeks',
      'date.schedule.on_date_lead': '{weekday}, {date}',
      'date.schedule.days_suffix_future': '(+{days} days)',
      'date.schedule.days_suffix_past': '({days} days ago)',
    };
    return map[key] ?? key;
  },
}));

vi.mock('src/modules/lang/dateFormat', () => ({
  formatAppWeekday: (_date: Date) => 'Sunday',
}));

describe('useTimeDiff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0)); // 2026-06-10 Wednesday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats today and tomorrow', () => {
    const { getTimeDifferenceDisplay } = useTimeDiff();
    expect(getTimeDifferenceDisplay('2026-06-10')).toBe('TODAY');
    expect(getTimeDifferenceDisplay('2026-06-11')).toBe('TOMORROW');
  });

  it('formats within a week as this weekday with day suffix', () => {
    expect(formatScheduleWeekdayPhrase('2026-06-15')).toBe('this Sunday (+5 days)');
  });

  it('formats exactly 7 days as in 1 week with day suffix', () => {
    expect(formatScheduleWeekdayPhrase('2026-06-17')).toBe('on Sunday in 1 week (+7 days)');
  });

  it('formats 8-13 days like 7 days with day suffix', () => {
    expect(formatScheduleWeekdayPhrase('2026-06-20')).toBe('on Sunday in 1 week (+10 days)');
  });

  it('formats exactly 14 days as in 2 weeks with day suffix', () => {
    expect(formatScheduleWeekdayPhrase('2026-06-24')).toBe('on Sunday in 2 weeks (+14 days)');
  });

  it('formats 15-20 days with embedded date and suffix at end', () => {
    const result = formatSchedulePhraseWithMeta('2026-06-27');
    expect(result.embedsDate).toBe(true);
    expect(result.lead).toBe('Sunday, 27.06.2026');
    expect(result.daysSuffix).toBe('(+17 days)');
    expect(result.phrase).toBe('Sunday, 27.06.2026 (+17 days)');
  });

  it('formats beyond 4 weeks with embedded date and suffix at end', () => {
    const result = formatSchedulePhraseWithMeta('2026-07-11');
    expect(result.embedsDate).toBe(true);
    expect(result.lead).toBe('Sunday, 11.07.2026');
    expect(result.daysSuffix).toBe('(+31 days)');
    expect(result.phrase).toBe('Sunday, 11.07.2026 (+31 days)');
  });
});
