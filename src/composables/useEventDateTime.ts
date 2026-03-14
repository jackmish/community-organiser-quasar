/**
 * useEventDateTime
 *
 * Extracts all date/time logic from AddTaskForm.vue so it can be tested in
 * isolation and reused if a second form variant is ever added.
 *
 * Manages:
 *  - timeType toggle (wholeDay / exactHour) with cached-time restore
 *  - eventTimeHour / eventTimeMinute writable computeds (v-model compatible)
 *  - eventTimeMode / eventTimeOffsetDays (prepare / expiration support)
 *  - eventDate / eventDateParts / eventDateDay / eventDateMonth / eventDateYear computeds
 *  - derived displays: eventDateTimeHoursDiff, eventTimeHoursDisplay
 *  - autoIncrementYear flag
 */

import { computed, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { formatEventHoursDiff } from 'src/modules/task/utils/occursOnDay';
import { useTimeDiff } from 'src/composables/useTimeDiff';

// Minimal task shape required by this composable (subset of the full TaskType)
export interface EventDateTimeTask {
  eventDate: string;
  eventTime: string;
  timeMode?: 'event' | 'prepare' | 'expiration';
  timeOffsetDays?: number | null;
}

export function useEventDateTime(localNewTask: Ref<EventDateTimeTask>) {
  // ─── Time-type toggle ───────────────────────────────────────────────────────

  const timeType = ref<'wholeDay' | 'exactHour'>('wholeDay');

  /** Static option list — kept here so the template doesn't duplicate them. */
  const timeTypeOptions = [
    { label: '', value: 'wholeDay', icon: 'calendar_today' },
    { label: '', value: 'exactHour', icon: 'schedule' },
  ];

  const timeModeOptions = [
    { label: 'Event', value: 'event', icon: 'event' },
    { label: 'Prepare', value: 'prepare', icon: 'local_shipping' },
    { label: 'Expiration', value: 'expiration', icon: 'hourglass_empty' },
  ];

  // Auto-increment year checkbox state (returned so template can v-model it)
  const autoIncrementYear = ref(true);

  // ─── Hour / minute v-model computeds ───────────────────────────────────────

  const eventTimeHour = computed<number | string>({
    get() {
      if (!localNewTask.value.eventTime) return '';
      return Number(localNewTask.value.eventTime.split(':')[0]);
    },
    set(v: number | string) {
      if (v === null || v === '') return;
      const hour = Number(v);
      if (isNaN(hour) || hour < 0 || hour > 23) return;
      timeType.value = 'exactHour';
      const minute = Number(eventTimeMinute.value) || 0;
      localNewTask.value.eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    },
  });

  const eventTimeMinute = computed<number | string>({
    get() {
      if (!localNewTask.value.eventTime) return '';
      return Number(localNewTask.value.eventTime.split(':')[1]);
    },
    set(v: number | string) {
      if (v === null || v === '') return;
      const minute = Number(v);
      if (isNaN(minute) || minute < 0 || minute > 59) return;
      timeType.value = 'exactHour';
      const hour = Number(eventTimeHour.value) || 0;
      localNewTask.value.eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    },
  });

  // ─── Derived time display ───────────────────────────────────────────────────

  /** Hours between now and the full event datetime; null when no time is set. */
  const eventDateTimeHoursDiff = computed<number | null>(() => {
    const dateStr = localNewTask.value.eventDate;
    const timeStr = localNewTask.value.eventTime;
    if (!dateStr || !timeStr) return null;
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    if (isNaN(dt.getTime())) return null;
    return (dt.getTime() - Date.now()) / (1000 * 60 * 60);
  });

  const eventTimeHoursDisplay = computed(() =>
    formatEventHoursDiff(localNewTask.value.eventDate, localNewTask.value.eventTime),
  );

  // ─── timeType watch: cache / restore time on toggle ────────────────────────

  const cachedTime = ref<{ hour: string | number | null; minute: string | number | null }>({
    hour: null,
    minute: null,
  });

  watch(timeType, (newValue, oldValue) => {
    if (newValue === 'wholeDay') {
      // Cache existing hour/minute before wiping the time string
      cachedTime.value.hour = eventTimeHour.value === '' ? null : eventTimeHour.value;
      cachedTime.value.minute = eventTimeMinute.value === '' ? null : eventTimeMinute.value;
      localNewTask.value.eventTime = '';
    } else if (oldValue === 'wholeDay' && newValue === 'exactHour') {
      const current = localNewTask.value.eventTime;
      // Don't overwrite a value the user may have typed while in wholeDay
      if (current && current !== '' && current !== '00:00') return;
      if (cachedTime.value.hour == null && cachedTime.value.minute == null) return;
      const h = cachedTime.value.hour == null ? 0 : Number(cachedTime.value.hour);
      const m = cachedTime.value.minute == null ? 0 : Number(cachedTime.value.minute);
      localNewTask.value.eventTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  });

  // ─── Time mode & offset days ────────────────────────────────────────────────

  const eventTimeMode = computed<'event' | 'prepare' | 'expiration'>({
    get() {
      return localNewTask.value.timeMode ?? 'event';
    },
    set(v) {
      localNewTask.value.timeMode = v;
    },
  });

  const eventTimeOffsetDays = computed<number | null>({
    get() {
      const v = localNewTask.value.timeOffsetDays;
      return v == null ? null : Number(v);
    },
    set(val: number | null) {
      localNewTask.value.timeOffsetDays = val == null ? null : Number(val);
    },
  });

  function setOffsetDays(n: number) {
    localNewTask.value.timeOffsetDays = Number(n);
  }

  // ─── Date-part computeds (v-model compatible) ───────────────────────────────

  const eventDate = computed(() => localNewTask.value.eventDate ?? '');
  const eventDateParts = computed(() => eventDate.value.split('-'));

  /** Exposes only the last two digits of the year in the input; stores full 4-digit. */
  const eventDateYear = computed<number>({
    get() {
      const full = eventDateParts.value[0]
        ? Number(eventDateParts.value[0])
        : new Date().getFullYear();
      return Number(String(full).slice(-2));
    },
    set(val: number) {
      if (eventDateParts.value.length !== 3) return;
      let yearNum = Number(val);
      if (isNaN(yearNum)) return;
      if (yearNum >= 0 && yearNum <= 99) {
        const baseCentury = Math.floor(new Date().getFullYear() / 100) * 100;
        yearNum = baseCentury + yearNum;
      }
      localNewTask.value.eventDate = `${String(yearNum).padStart(4, '0')}-${eventDateParts.value[1]}-${eventDateParts.value[2]}`;
    },
  });

  const eventDateMonth = computed<number>({
    get() {
      return eventDateParts.value[1] ? Number(eventDateParts.value[1]) : new Date().getMonth() + 1;
    },
    set(val: number) {
      if (eventDateParts.value.length === 3) {
        localNewTask.value.eventDate = `${eventDateParts.value[0]}-${String(val).padStart(2, '0')}-${eventDateParts.value[2]}`;
      }
    },
  });

  const eventDateDay = computed<number>({
    get() {
      return eventDateParts.value[2] ? Number(eventDateParts.value[2]) : new Date().getDate();
    },
    set(val: number) {
      if (eventDateParts.value.length === 3) {
        localNewTask.value.eventDate = `${eventDateParts.value[0]}-${eventDateParts.value[1]}-${String(val).padStart(2, '0')}`;
      }
    },
  });

  // Expose getTimeDifferenceDisplay from useTimeDiff for template use
  const { getTimeDifferenceDisplay } = useTimeDiff();

  return {
    // toggle
    timeType,
    timeTypeOptions,
    timeModeOptions,
    autoIncrementYear,
    // hour/minute
    eventTimeHour,
    eventTimeMinute,
    // derived display
    eventDateTimeHoursDiff,
    eventTimeHoursDisplay,
    getTimeDifferenceDisplay,
    // cache
    cachedTime,
    // mode + offset
    eventTimeMode,
    eventTimeOffsetDays,
    setOffsetDays,
    // date parts
    eventDate,
    eventDateParts,
    eventDateYear,
    eventDateMonth,
    eventDateDay,
  };
}
