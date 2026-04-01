import { describe, it, expect } from 'vitest';
import { clampDateToMonth, fixInvalidDatesInDays } from 'src/utils/dateUtils';

describe('clampDateToMonth', () => {
  it('returns valid dates unchanged', () => {
    expect(clampDateToMonth('2026-01-31')).toBe('2026-01-31');
    expect(clampDateToMonth('2026-02-28')).toBe('2026-02-28');
    expect(clampDateToMonth('2026-06-30')).toBe('2026-06-30');
  });

  it('clamps February overflow (non-leap year)', () => {
    expect(clampDateToMonth('2026-02-29')).toBe('2026-02-28');
    expect(clampDateToMonth('2026-02-30')).toBe('2026-02-28');
    expect(clampDateToMonth('2026-02-31')).toBe('2026-02-28');
  });

  it('clamps February overflow (leap year)', () => {
    expect(clampDateToMonth('2024-02-29')).toBe('2024-02-29'); // valid leap day
    expect(clampDateToMonth('2024-02-30')).toBe('2024-02-29');
  });

  it('clamps 31 in months with 30 days', () => {
    expect(clampDateToMonth('2026-04-31')).toBe('2026-04-30');
    expect(clampDateToMonth('2026-06-31')).toBe('2026-06-30');
    expect(clampDateToMonth('2026-09-31')).toBe('2026-09-30');
    expect(clampDateToMonth('2026-11-31')).toBe('2026-11-30');
  });

  it('returns null for null/undefined input', () => {
    expect(clampDateToMonth(null)).toBeNull();
    expect(clampDateToMonth(undefined)).toBeNull();
  });

  it('returns original value for non-parseable strings', () => {
    expect(clampDateToMonth('not-a-date')).toBe('not-a-date');
    expect(clampDateToMonth('')).toBeNull();
  });
});

describe('fixInvalidDatesInDays', () => {
  it('returns 0 for empty or null input', () => {
    expect(fixInvalidDatesInDays({})).toBe(0);
    // @ts-expect-error testing null
    expect(fixInvalidDatesInDays(null)).toBe(0);
  });

  it('fixes task date and eventDate fields in-place', () => {
    const days: Record<string, any> = {
      '2026-02-15': {
        date: '2026-02-15',
        tasks: [
          { id: '1', date: '2026-02-30', eventDate: '2026-02-31' },
          { id: '2', date: '2026-06-31', eventDate: '2026-06-31' },
        ],
        notes: '',
      },
    };
    const fixes = fixInvalidDatesInDays(days);
    expect(fixes).toBe(4); // 2 date + 2 eventDate
    expect(days['2026-02-15'].tasks[0].date).toBe('2026-02-28');
    expect(days['2026-02-15'].tasks[0].eventDate).toBe('2026-02-28');
    expect(days['2026-02-15'].tasks[1].date).toBe('2026-06-30');
    expect(days['2026-02-15'].tasks[1].eventDate).toBe('2026-06-30');
  });

  it('leaves valid task fields unchanged', () => {
    const days: Record<string, any> = {
      '2026-03-10': {
        date: '2026-03-10',
        tasks: [{ id: '1', date: '2026-03-10', eventDate: '2026-03-10' }],
        notes: '',
      },
    };
    expect(fixInvalidDatesInDays(days)).toBe(0);
    expect(days['2026-03-10'].tasks[0].date).toBe('2026-03-10');
  });

  it('migrates tasks from an invalid day key to the corrected key', () => {
    const days: Record<string, any> = {
      '2026-02-31': {
        date: '2026-02-31',
        tasks: [{ id: '10', date: '2026-02-31', eventDate: '2026-02-31' }],
        notes: 'hello',
      },
    };
    const fixes = fixInvalidDatesInDays(days);
    // The day key migration counts as 1 fix, plus task fields
    expect(fixes).toBeGreaterThan(0);
    expect(days['2026-02-31']).toBeUndefined();
    expect(days['2026-02-28']).toBeDefined();
    expect(days['2026-02-28'].tasks.some((t: any) => t.id === '10')).toBe(true);
  });

  it('merges tasks when valid key already exists', () => {
    const days: Record<string, any> = {
      '2026-04-30': {
        date: '2026-04-30',
        tasks: [{ id: 'existing', date: '2026-04-30' }],
        notes: '',
      },
      '2026-04-31': {
        date: '2026-04-31',
        tasks: [{ id: 'migrated', date: '2026-04-31' }],
        notes: '',
      },
    };
    fixInvalidDatesInDays(days);
    expect(days['2026-04-31']).toBeUndefined();
    const dest = days['2026-04-30'];
    expect(dest.tasks.some((t: any) => t.id === 'existing')).toBe(true);
    expect(dest.tasks.some((t: any) => t.id === 'migrated')).toBe(true);
  });

  it('does not duplicate tasks when merging', () => {
    const days: Record<string, any> = {
      '2026-04-30': {
        date: '2026-04-30',
        tasks: [{ id: 'shared', date: '2026-04-30' }],
        notes: '',
      },
      '2026-04-31': {
        date: '2026-04-31',
        tasks: [{ id: 'shared', date: '2026-04-31' }], // same id
        notes: '',
      },
    };
    fixInvalidDatesInDays(days);
    const dest = days['2026-04-30'];
    const occurrences = dest.tasks.filter((t: any) => t.id === 'shared').length;
    expect(occurrences).toBe(1);
  });
});
