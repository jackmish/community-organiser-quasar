import { describe, it, expect } from 'vitest';
import {
  parseYmdLocal,
  dayOfMonthFromYmdString,
  formatEventHoursDiff,
  getCycleType,
  getRepeatDays,
  occursOnDay,
} from '../../src/modules/task/utils/occursOnDay';

// ─── parseYmdLocal ────────────────────────────────────────────────────────────
describe('parseYmdLocal', () => {
  it('parses a valid YYYY-MM-DD string into a local Date', () => {
    const d = parseYmdLocal('2026-03-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2); // 0-indexed
    expect(d!.getDate()).toBe(15);
  });

  it('does not shift the date due to timezone offset', () => {
    // New Date('2026-01-01') is parsed as UTC midnight which can land on Dec 31 in UTC-N zones.
    // parseYmdLocal must always give Jan 1 locally.
    const d = parseYmdLocal('2026-01-01');
    expect(d!.getDate()).toBe(1);
    expect(d!.getMonth()).toBe(0);
  });

  it('returns null for empty / undefined input', () => {
    expect(parseYmdLocal('')).toBeNull();
    expect(parseYmdLocal(null)).toBeNull();
    expect(parseYmdLocal(undefined)).toBeNull();
  });

  it('returns null for a non-date string', () => {
    expect(parseYmdLocal('not-a-date')).toBeNull();
  });
});

// ─── dayOfMonthFromYmdString ──────────────────────────────────────────────────
describe('dayOfMonthFromYmdString', () => {
  it('returns the written day even when that calendar date is invalid (monthly nth intent)', () => {
    expect(dayOfMonthFromYmdString('2026-04-31')).toBe(31);
  });

  it('returns the day for valid YYYY-MM-DD', () => {
    expect(dayOfMonthFromYmdString('2026-04-30')).toBe(30);
  });

  it('reads date part before T in ISO datetime strings', () => {
    expect(dayOfMonthFromYmdString('2026-04-31T12:00:00')).toBe(31);
  });

  it('returns null for malformed input', () => {
    expect(dayOfMonthFromYmdString('')).toBeNull();
    expect(dayOfMonthFromYmdString(null)).toBeNull();
    expect(dayOfMonthFromYmdString('not-a-date')).toBeNull();
  });
});

// ─── formatEventHoursDiff ─────────────────────────────────────────────────────
describe('formatEventHoursDiff', () => {
  // Pin `now` to 2026-03-12 10:00
  const NOW = new Date(2026, 2, 12, 10, 0, 0);

  it('returns an empty string when date or time is missing', () => {
    expect(formatEventHoursDiff('', '10:00', NOW)).toBe('');
    expect(formatEventHoursDiff('2026-03-12', '', NOW)).toBe('');
  });

  it('shows "In X" for a future event on the same day', () => {
    const result = formatEventHoursDiff('2026-03-12', '12:30', NOW);
    expect(result).toMatch(/^In /);
    expect(result).toContain('2h');
    expect(result).toContain('30m');
  });

  it('shows "ago" for a past event on the same day', () => {
    const result = formatEventHoursDiff('2026-03-12', '08:00', NOW);
    expect(result).toMatch(/ago$/);
    expect(result).toContain('2h');
  });

  it('shows days for an event more than 24 h away', () => {
    const result = formatEventHoursDiff('2026-03-15', '10:00', NOW);
    expect(result).toMatch(/^In /);
    expect(result).toContain('3d');
  });

  it('shows "0m" for an event exactly at now', () => {
    const result = formatEventHoursDiff('2026-03-12', '10:00', NOW);
    expect(result).toContain('0m');
  });
});

// ─── getCycleType ─────────────────────────────────────────────────────────────
describe('getCycleType', () => {
  it('returns null for a task without a repeat object', () => {
    expect(getCycleType({ name: 'no repeat' })).toBeNull();
    expect(getCycleType(null)).toBeNull();
  });

  it('returns null when repeat is null', () => {
    expect(getCycleType({ repeat: null })).toBeNull();
  });

  it('picks up cycleType from repeat object', () => {
    expect(getCycleType({ repeat: { cycleType: 'dayWeek' } })).toBe('dayWeek');
    expect(getCycleType({ repeat: { cycle_type: 'month' } })).toBe('month');
  });
});

// ─── getRepeatDays ────────────────────────────────────────────────────────────
describe('getRepeatDays', () => {
  it('reads from repeat.days', () => {
    expect(getRepeatDays({ repeat: { days: ['mon', 'fri'] } })).toEqual(['mon', 'fri']);
  });

  it('falls back to task.repeatDays', () => {
    expect(getRepeatDays({ repeatDays: ['tue'] })).toEqual(['tue']);
  });

  it('returns an empty array when nothing is set', () => {
    expect(getRepeatDays({ repeat: {} })).toEqual([]);
    expect(getRepeatDays({})).toEqual([]);
  });
});

// ─── occursOnDay ──────────────────────────────────────────────────────────────
describe('occursOnDay', () => {
  // ── non-cyclic ────────────────────────────────────────────────────────────
  it('matches a one-time task by eventDate', () => {
    expect(occursOnDay({ eventDate: '2026-03-12' }, '2026-03-12')).toBe(true);
    expect(occursOnDay({ eventDate: '2026-03-12' }, '2026-03-13')).toBe(false);
  });

  it('matches a one-time task by date field', () => {
    expect(occursOnDay({ date: '2026-04-01' }, '2026-04-01')).toBe(true);
  });

  it('returns false for a null task', () => {
    expect(occursOnDay(null, '2026-03-12')).toBe(false);
  });

  it('returns false when no date fields are present', () => {
    expect(occursOnDay({ name: 'no date' }, '2026-03-12')).toBe(false);
  });

  // ── dayWeek cycle ─────────────────────────────────────────────────────────
  it('dayWeek: matches when target weekday is in the repeat list', () => {
    // 2026-03-12 is a Thursday
    const task = { repeat: { cycleType: 'dayWeek', days: ['thu'] } };
    expect(occursOnDay(task, '2026-03-12')).toBe(true);
  });

  it('dayWeek: does not match on an unlisted weekday', () => {
    const task = { repeat: { cycleType: 'dayWeek', days: ['mon', 'wed'] } };
    // 2026-03-12 is Thursday
    expect(occursOnDay(task, '2026-03-12')).toBe(false);
  });

  it('dayWeek: accepts full weekday names', () => {
    const task = { repeat: { cycleType: 'dayWeek', days: ['Thursday'] } };
    expect(occursOnDay(task, '2026-03-12')).toBe(true);
  });

  it('dayWeek: accepts numeric weekday values (0=Sun … 6=Sat)', () => {
    // 2026-03-15 is a Sunday (0)
    const task = { repeat: { cycleType: 'dayWeek', days: [0] } };
    expect(occursOnDay(task, '2026-03-15')).toBe(true);
  });

  // ── monthly cycle ─────────────────────────────────────────────────────────
  it('month: matches on the same day-of-month', () => {
    const task = { repeat: { cycleType: 'month', eventDate: '2026-01-20' } };
    expect(occursOnDay(task, '2026-03-20')).toBe(true);
    expect(occursOnDay(task, '2026-03-19')).toBe(false);
  });

  it('month: clamps to last day when seed day > days in target month', () => {
    // seed is Jan 31; Feb only has 28 days in 2026 → should match Feb 28
    const task = { repeat: { cycleType: 'month', eventDate: '2026-01-31' } };
    expect(occursOnDay(task, '2026-02-28')).toBe(true);
    expect(occursOnDay(task, '2026-02-27')).toBe(false);
  });

  it('month: nth intent 31 from invalid literal date string clamps to last day (not day 1)', () => {
    // Stored like buildRepeatPayload: April has no 31st; written DD must stay 31 for clamp logic
    const task = { repeat: { cycleType: 'month', eventDate: '2026-04-31' } };
    expect(occursOnDay(task, '2026-04-30')).toBe(true);
    expect(occursOnDay(task, '2026-04-01')).toBe(false);
    expect(occursOnDay(task, '2026-05-01')).toBe(false);
  });

  // ── yearly cycle ──────────────────────────────────────────────────────────
  it('year: matches on the same month and day', () => {
    const task = { repeat: { cycleType: 'year', eventDate: '2024-07-04' } };
    expect(occursOnDay(task, '2026-07-04')).toBe(true);
    expect(occursOnDay(task, '2026-07-05')).toBe(false);
    expect(occursOnDay(task, '2026-08-04')).toBe(false);
  });

  // ── interval (other) cycle ────────────────────────────────────────────────
  it('other: matches every N days from the seed', () => {
    // Seed 2026-03-01, interval 7 → should match 2026-03-08, 2026-03-15, …
    const task = {
      repeat: { cycleType: 'other', eventDate: '2026-03-01', intervalDays: 7 },
    };
    expect(occursOnDay(task, '2026-03-01')).toBe(true); // diff=0, 0%7=0
    expect(occursOnDay(task, '2026-03-08')).toBe(true); // diff=7
    expect(occursOnDay(task, '2026-03-15')).toBe(true); // diff=14
    expect(occursOnDay(task, '2026-03-09')).toBe(false); // diff=8
  });

  it('other: does not match days before the seed', () => {
    const task = {
      repeat: { cycleType: 'other', eventDate: '2026-03-10', intervalDays: 3 },
    };
    expect(occursOnDay(task, '2026-03-07')).toBe(false);
  });

  it('other: returns false when intervalDays is 0', () => {
    const task = {
      repeat: { cycleType: 'other', eventDate: '2026-03-01', intervalDays: 0 },
    };
    expect(occursOnDay(task, '2026-03-01')).toBe(false);
  });
});
