import { describe, expect, it } from 'vitest';
import {
  CALENDAR_TONED_MONTH_COUNT,
  calendarTonedMonthColor,
  getOverlayColorForMonth,
  monthOffsetFromToday,
  resolveCalendarTheme,
} from 'src/components/theme';

describe('calendar theme', () => {
  it('resolveCalendarTheme includes text color', () => {
    const t = resolveCalendarTheme({
      calendarColorize: true,
      color: '#112233',
      textColor: '#ff00aa',
    });
    expect(t.colorize).toBe(true);
    expect(t.groupColor).toBe('#112233');
    expect(t.groupTextColor).toBe('#ff00aa');
  });

  it('dark group color tones lighter for first 3 months', () => {
    const dark = '#112233';
    const c0 = calendarTonedMonthColor(dark, 0);
    const c1 = calendarTonedMonthColor(dark, 1);
    const c2 = calendarTonedMonthColor(dark, 2);
    expect(c0).toBe(dark);
    expect(c1).not.toBe(c0);
    expect(c2).not.toBe(c1);
    // lighter = higher channel sum roughly
    const sum = (h: string) => {
      const n = parseInt(h.replace('#', ''), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(sum(c2)).toBeGreaterThan(sum(c0));
  });

  it('bright group color tones darker for first 3 months', () => {
    const bright = '#ffff88';
    const c0 = calendarTonedMonthColor(bright, 0);
    const c2 = calendarTonedMonthColor(bright, 2);
    const sum = (h: string) => {
      const n = parseInt(h.replace('#', ''), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(sum(c2)).toBeLessThan(sum(c0));
  });

  it('months after toned range morph toward group text color', () => {
    const theme = {
      colorize: true,
      groupColor: '#112233',
      groupTextColor: '#ff00aa',
    };
    const anchorMonth = new Date();
    anchorMonth.setMonth(anchorMonth.getMonth() + CALENDAR_TONED_MONTH_COUNT);
    const farMonth = new Date();
    farMonth.setMonth(farMonth.getMonth() + 11);

    const [bgNear] = getOverlayColorForMonth(anchorMonth, theme);
    const [bgFar] = getOverlayColorForMonth(farMonth, theme);

    expect(bgNear).not.toBe(theme.groupTextColor);
    expect(bgFar.toLowerCase()).toBe(theme.groupTextColor.toLowerCase());
  });

  it('legacy palette when colorize is off', () => {
    const [bg] = getOverlayColorForMonth(new Date(), { colorize: false, groupColor: '#f00', groupTextColor: '#000' });
    expect(bg).toBe('#ffffff');
  });

  it('monthOffsetFromToday wraps year', () => {
    const today = new Date();
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    expect(monthOffsetFromToday(next)).toBe(1);
  });
});
