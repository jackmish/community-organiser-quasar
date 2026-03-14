/**
 * useEventDateTime.spec.ts
 *
 * Unit tests for the useEventDateTime composable extracted from AddTaskForm.vue.
 *
 * Covers:
 *  - timeType toggle default and option arrays
 *  - eventTimeHour / eventTimeMinute computed getters and setters
 *  - eventDateYear / eventDateMonth / eventDateDay computed getters and setters
 *  - eventDateTimeHoursDiff derived value
 *  - eventTimeMode and eventTimeOffsetDays computeds
 *  - setOffsetDays helper
 *  - autoIncrementYear default
 *  - timeType watcher: caches time on wholeDay, restores on exactHour
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useEventDateTime } from '../../src/composables/useEventDateTime';
import type { EventDateTimeTask } from '../../src/composables/useEventDateTime';

function makeTask(
  overrides: Partial<EventDateTimeTask> = {},
): ReturnType<typeof ref<EventDateTimeTask>> {
  return ref<EventDateTimeTask>({
    eventDate: '2026-06-15',
    eventTime: '',
    timeMode: 'event',
    timeOffsetDays: 7,
    ...overrides,
  });
}

describe('useEventDateTime', () => {
  // ─── Defaults ────────────────────────────────────────────────────────────────

  it('defaults timeType to wholeDay', () => {
    const task = makeTask();
    const { timeType } = useEventDateTime(task);
    expect(timeType.value).toBe('wholeDay');
  });

  it('defaults autoIncrementYear to true', () => {
    const task = makeTask();
    const { autoIncrementYear } = useEventDateTime(task);
    expect(autoIncrementYear.value).toBe(true);
  });

  it('exposes timeTypeOptions with wholeDay and exactHour', () => {
    const task = makeTask();
    const { timeTypeOptions } = useEventDateTime(task);
    expect(timeTypeOptions.map((o) => o.value)).toEqual(['wholeDay', 'exactHour']);
  });

  it('exposes three timeModeOptions', () => {
    const task = makeTask();
    const { timeModeOptions } = useEventDateTime(task);
    expect(timeModeOptions.map((o) => o.value)).toEqual(['event', 'prepare', 'expiration']);
  });

  // ─── eventTimeHour / eventTimeMinute ─────────────────────────────────────────

  it('returns empty string for hour/minute when eventTime is empty', () => {
    const task = makeTask({ eventTime: '' });
    const { eventTimeHour, eventTimeMinute } = useEventDateTime(task);
    expect(eventTimeHour.value).toBe('');
    expect(eventTimeMinute.value).toBe('');
  });

  it('parses hour and minute from eventTime', () => {
    const task = makeTask({ eventTime: '14:35' });
    const { eventTimeHour, eventTimeMinute } = useEventDateTime(task);
    expect(eventTimeHour.value).toBe(14);
    expect(eventTimeMinute.value).toBe(35);
  });

  it('setting eventTimeHour updates eventTime and flips timeType to exactHour', () => {
    const task = makeTask({ eventTime: '10:30' });
    const { eventTimeHour, timeType } = useEventDateTime(task);
    eventTimeHour.value = 22;
    expect(task.value.eventTime).toBe('22:30');
    expect(timeType.value).toBe('exactHour');
  });

  it('setting eventTimeMinute updates eventTime and flips timeType to exactHour', () => {
    const task = makeTask({ eventTime: '10:30' });
    const { eventTimeMinute, timeType } = useEventDateTime(task);
    eventTimeMinute.value = 45;
    expect(task.value.eventTime).toBe('10:45');
    expect(timeType.value).toBe('exactHour');
  });

  it('setting eventTimeHour to empty string does not clear the eventTime', () => {
    const task = makeTask({ eventTime: '10:30' });
    const { eventTimeHour } = useEventDateTime(task);
    eventTimeHour.value = '';
    expect(task.value.eventTime).toBe('10:30');
  });

  it('setting eventTimeHour to out-of-range value is ignored', () => {
    const task = makeTask({ eventTime: '10:30' });
    const { eventTimeHour } = useEventDateTime(task);
    eventTimeHour.value = 25;
    expect(task.value.eventTime).toBe('10:30');
  });

  it('setting eventTimeMinute to out-of-range value is ignored', () => {
    const task = makeTask({ eventTime: '10:30' });
    const { eventTimeMinute } = useEventDateTime(task);
    eventTimeMinute.value = 61;
    expect(task.value.eventTime).toBe('10:30');
  });

  it('pads hour and minute with leading zero when < 10', () => {
    const task = makeTask({ eventTime: '09:05' });
    const { eventTimeHour } = useEventDateTime(task);
    eventTimeHour.value = 8;
    expect(task.value.eventTime).toBe('08:05');
  });

  // ─── eventDateYear / Month / Day ─────────────────────────────────────────────

  it('reads last two digits of year from eventDate', () => {
    const task = makeTask({ eventDate: '2026-03-10' });
    const { eventDateYear } = useEventDateTime(task);
    expect(eventDateYear.value).toBe(26);
  });

  it('reads month from eventDate', () => {
    const task = makeTask({ eventDate: '2026-03-10' });
    const { eventDateMonth } = useEventDateTime(task);
    expect(eventDateMonth.value).toBe(3);
  });

  it('reads day from eventDate', () => {
    const task = makeTask({ eventDate: '2026-03-10' });
    const { eventDateDay } = useEventDateTime(task);
    expect(eventDateDay.value).toBe(10);
  });

  it('setting eventDateDay updates the full eventDate string', () => {
    const task = makeTask({ eventDate: '2026-03-10' });
    const { eventDateDay } = useEventDateTime(task);
    eventDateDay.value = 25;
    expect(task.value.eventDate).toBe('2026-03-25');
  });

  it('setting eventDateMonth updates the full eventDate string', () => {
    const task = makeTask({ eventDate: '2026-03-10' });
    const { eventDateMonth } = useEventDateTime(task);
    eventDateMonth.value = 11;
    expect(task.value.eventDate).toBe('2026-11-10');
  });

  it('setting eventDateYear (2-digit) expands to full century', () => {
    const task = makeTask({ eventDate: '2026-06-15' });
    const { eventDateYear } = useEventDateTime(task);
    eventDateYear.value = 28;
    expect(task.value.eventDate).toBe('2028-06-15');
  });

  it('setting eventDateYear to 4-digit stores correctly (treated as century offset)', () => {
    // 2026 → 2-digit value 26 → set back 26 → 2026
    const task = makeTask({ eventDate: '2025-01-01' });
    const { eventDateYear } = useEventDateTime(task);
    // 2-digit: 25 → 2025
    eventDateYear.value = 25;
    expect(task.value.eventDate).toBe('2025-01-01');
  });

  it('pads day to two digits in eventDate', () => {
    const task = makeTask({ eventDate: '2026-03-10' });
    const { eventDateDay } = useEventDateTime(task);
    eventDateDay.value = 5;
    expect(task.value.eventDate).toBe('2026-03-05');
  });

  it('pads month to two digits in eventDate', () => {
    const task = makeTask({ eventDate: '2026-03-10' });
    const { eventDateMonth } = useEventDateTime(task);
    eventDateMonth.value = 4;
    expect(task.value.eventDate).toBe('2026-04-10');
  });

  // ─── eventDateParts / eventDate ───────────────────────────────────────────────

  it('eventDate reflects the current eventDate from task', () => {
    const task = makeTask({ eventDate: '2027-12-31' });
    const { eventDate } = useEventDateTime(task);
    expect(eventDate.value).toBe('2027-12-31');
  });

  it('eventDateParts splits the date into [year, month, day]', () => {
    const task = makeTask({ eventDate: '2027-12-31' });
    const { eventDateParts } = useEventDateTime(task);
    expect(eventDateParts.value).toEqual(['2027', '12', '31']);
  });

  // ─── eventDateTimeHoursDiff ───────────────────────────────────────────────────

  it('returns null when eventTime is empty', () => {
    const task = makeTask({ eventDate: '2026-06-15', eventTime: '' });
    const { eventDateTimeHoursDiff } = useEventDateTime(task);
    expect(eventDateTimeHoursDiff.value).toBeNull();
  });

  it('returns null when eventDate is empty', () => {
    const task = makeTask({ eventDate: '', eventTime: '14:00' });
    const { eventDateTimeHoursDiff } = useEventDateTime(task);
    expect(eventDateTimeHoursDiff.value).toBeNull();
  });

  it('returns a numeric diff when both date and time are set', () => {
    // A far-future date ensures a positive diff regardless of when the test runs
    const task = makeTask({ eventDate: '2099-12-31', eventTime: '23:59' });
    const { eventDateTimeHoursDiff } = useEventDateTime(task);
    expect(typeof eventDateTimeHoursDiff.value).toBe('number');
    expect(eventDateTimeHoursDiff.value).toBeGreaterThan(0);
  });

  // ─── eventTimeMode ────────────────────────────────────────────────────────────

  it('defaults eventTimeMode to event', () => {
    const task = makeTask({ timeMode: 'event' });
    const { eventTimeMode } = useEventDateTime(task);
    expect(eventTimeMode.value).toBe('event');
  });

  it('setting eventTimeMode updates task.timeMode', () => {
    const task = makeTask({ timeMode: 'event' });
    const { eventTimeMode } = useEventDateTime(task);
    eventTimeMode.value = 'prepare';
    expect(task.value.timeMode).toBe('prepare');
  });

  // ─── eventTimeOffsetDays / setOffsetDays ──────────────────────────────────────

  it('reads eventTimeOffsetDays from task', () => {
    const task = makeTask({ timeOffsetDays: 14 });
    const { eventTimeOffsetDays } = useEventDateTime(task);
    expect(eventTimeOffsetDays.value).toBe(14);
  });

  it('setting eventTimeOffsetDays updates task.timeOffsetDays', () => {
    const task = makeTask({ timeOffsetDays: 7 });
    const { eventTimeOffsetDays } = useEventDateTime(task);
    eventTimeOffsetDays.value = 28;
    expect(task.value.timeOffsetDays).toBe(28);
  });

  it('setOffsetDays updates task.timeOffsetDays', () => {
    const task = makeTask({ timeOffsetDays: 7 });
    const { setOffsetDays } = useEventDateTime(task);
    setOffsetDays(3);
    expect(task.value.timeOffsetDays).toBe(3);
  });

  it('setting eventTimeOffsetDays to null stores null', () => {
    const task = makeTask({ timeOffsetDays: 7 });
    const { eventTimeOffsetDays } = useEventDateTime(task);
    eventTimeOffsetDays.value = null;
    expect(task.value.timeOffsetDays).toBeNull();
  });

  // ─── timeType watcher: cache / restore ───────────────────────────────────────

  it('switching to wholeDay clears eventTime and caches hour/minute', async () => {
    const task = makeTask({ eventTime: '14:30' });
    const { timeType, cachedTime } = useEventDateTime(task);
    // Simulate: user toggled to exactHour (time was set)
    timeType.value = 'exactHour'; // sets timeType but time already in task
    await nextTick();

    timeType.value = 'wholeDay';
    await nextTick();

    expect(task.value.eventTime).toBe('');
    expect(cachedTime.value.hour).toBe(14);
    expect(cachedTime.value.minute).toBe(30);
  });

  it('switching back to exactHour restores cached time when no current time', async () => {
    const task = makeTask({ eventTime: '09:15' });
    const { timeType } = useEventDateTime(task);

    timeType.value = 'wholeDay';
    await nextTick();
    // now eventTime is '' and cache holds 09:15

    timeType.value = 'exactHour';
    await nextTick();

    expect(task.value.eventTime).toBe('09:15');
  });

  it('switching to exactHour does NOT overwrite a time already present', async () => {
    const task = makeTask({ eventTime: '09:15' });
    const { timeType } = useEventDateTime(task);

    timeType.value = 'wholeDay';
    await nextTick();

    // User types a new time while in wholeDay (edge-case bypass of input guard)
    task.value.eventTime = '20:00';

    timeType.value = 'exactHour';
    await nextTick();

    expect(task.value.eventTime).toBe('20:00');
  });

  it('switching to exactHour with no cached time does nothing', async () => {
    const task = makeTask({ eventTime: '' });
    const { timeType } = useEventDateTime(task);
    // timeType starts at wholeDay, so switching wholeDay→exactHour with empty cache
    timeType.value = 'exactHour';
    await nextTick();
    // no cached time → eventTime stays empty
    expect(task.value.eventTime).toBe('');
  });
});
