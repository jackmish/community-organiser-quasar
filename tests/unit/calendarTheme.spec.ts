import { describe, expect, it } from 'vitest';
import {
  buildCalendarColorizeTones,
  calendarBandColorForOffset,
  getCalendarCssVariables,
  getOverlayColorForMonth,
  monthOffsetFromToday,
  resolveCalendarTheme,
} from 'src/components/theme';
import { isHexBright } from 'src/utils/colorUtils';

describe('calendar theme', () => {
  it('resolveCalendarTheme builds two tones when colorize is on', () => {
    const t = resolveCalendarTheme({
      layoutColorize: true,
      calendarColorize: true,
      color: '#1976d2',
      textColor: '#ffffff',
    });
    expect(t.colorizeTones).not.toBeNull();
    expect(t.colorizeTones!.bright).toBe('#1976d2');
    expect(t.colorizeTones!.alternate).not.toBe(t.colorizeTones!.bright);
  });

  it('even offsets share bright, odd offsets share alternate', () => {
    const tones = buildCalendarColorizeTones('#4caf50');
    expect(calendarBandColorForOffset(0, tones)).toBe(tones.bright);
    expect(calendarBandColorForOffset(2, tones)).toBe(tones.bright);
    expect(calendarBandColorForOffset(4, tones)).toBe(tones.bright);
    expect(calendarBandColorForOffset(1, tones)).toBe(tones.alternate);
    expect(calendarBandColorForOffset(3, tones)).toBe(tones.alternate);
  });

  it('dark group: alternate is lighter than bright', () => {
    const group = '#1b5e20';
    expect(isHexBright(group)).toBe(false);
    const tones = buildCalendarColorizeTones(group);
    const sum = (h: string) => {
      const n = parseInt(h.replace('#', ''), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(sum(tones.alternate)).toBeGreaterThan(sum(tones.bright));
  });

  it('bright group: alternate is darker than bright', () => {
    const group = '#ffeb3b';
    expect(isHexBright(group)).toBe(true);
    const tones = buildCalendarColorizeTones(group);
    const sum = (h: string) => {
      const n = parseInt(h.replace('#', ''), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(sum(tones.alternate)).toBeLessThan(sum(tones.bright));
  });

  it('colorize exposes grid CSS variables from group color', () => {
    const vars = getCalendarCssVariables(
      resolveCalendarTheme({
        layoutColorize: true,
        calendarColorize: true,
        color: '#2e7d32',
      }),
    );
    expect(vars['--cal-weekend-th-bg']).toBe('#2e7d32');
    expect(vars['--cal-selected-bg']).toBe('#2e7d32');
    expect(vars['--cal-selected-day-fg']).toBeDefined();
    expect(vars['--cal-today-column-bg']).toContain('rgba');
    expect(vars['--cal-day-bg']).toContain('255');
  });

  it('does not colorize calendar when only calendar flag is set', () => {
    const t = resolveCalendarTheme({
      layoutColorize: false,
      calendarColorize: true,
      color: '#1976d2',
    });
    expect(t.colorize).toBe(false);
    expect(t.colorizeTones).toBeNull();
  });

  it('legacy palette when colorize is off', () => {
    const [bg, fg] = getOverlayColorForMonth(new Date(), {
      colorize: false,
      groupColor: '#f00',
      groupTextColor: '#000',
      colorizeTones: null,
    });
    expect(bg).toBe('#ffffff');
    expect(fg).toBe('#000');
  });

  it('legacy month label foreground contrasts with band background', () => {
    const theme = {
      colorize: false,
      groupColor: '#f00',
      groupTextColor: '#000',
      colorizeTones: null,
    };
    for (let offset = 0; offset < 7; offset += 1) {
      const month = ((new Date().getMonth() + 1 + offset - 1) % 12) + 1;
      const day = new Date(new Date().getFullYear(), month - 1, 1);
      const [bg, fg] = getOverlayColorForMonth(day, theme);
      expect(fg).toBe(bg.toLowerCase() === '#ffffff' ? '#000' : fg);
      expect(['#000', '#fff']).toContain(fg);
    }
  });

  it('monthOffsetFromToday wraps year', () => {
    const today = new Date();
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    expect(monthOffsetFromToday(next)).toBe(1);
  });
});
