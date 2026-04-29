import { ref, watch } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { dayOfMonthFromYmdString } from 'src/modules/task/utils/occursOnDay';

/**
 * Encapsulates all state and logic for the repeat/cycle section of the task form.
 * Used by AddTaskForm.vue.
 */
export function useRepeatSchedule(options?: {
  /** Current event date (YYYY-MM-DD) — used to pre-fill the nth-day field. */
  currentEventDate?: Ref<string> | ComputedRef<string>;
}) {
  const repeatMode = ref<'oneTime' | 'cyclic'>('oneTime');
  const repeatOptions = [
    { label: 'One time', value: 'oneTime', icon: 'event' },
    { label: 'Cyclic', value: 'cyclic', icon: 'repeat' },
  ];

  const repeatCycleType = ref<'dayWeek' | 'interval' | 'nth'>('dayWeek');
  const repeatCycleOptions = [
    { label: 'Day/Week', value: 'dayWeek', icon: 'today' },
    { label: 'Interval', value: 'interval', icon: 'repeat' },
    { label: 'Nth', value: 'nth', icon: 'looks_one' },
  ];

  const weekDayOptions = [
    { label: 'Mon', value: 'mon' },
    { label: 'Tue', value: 'tue' },
    { label: 'Wed', value: 'wed' },
    { label: 'Thu', value: 'thu' },
    { label: 'Fri', value: 'fri' },
    { label: 'Sat', value: 'sat' },
    { label: 'Sun', value: 'sun' },
  ];

  const repeatDays = ref<string[]>([]);
  const everyNDayOfMonth = ref<number | null>(null);
  const repeatIntervalDays = ref<number | null>(null);

  function checkAllDays() {
    repeatDays.value = weekDayOptions.map((o) => o.value);
  }

  function clearDays() {
    repeatDays.value = [];
  }

  function toggleDay(day: string) {
    const idx = repeatDays.value.indexOf(day);
    if (idx === -1) repeatDays.value = [...repeatDays.value, day];
    else repeatDays.value = repeatDays.value.filter((d) => d !== day);
  }

  // When cycle type changes, set sensible defaults
  watch(repeatCycleType, (val) => {
    try {
      if (val === 'interval') {
        if (
          !everyNDayOfMonth.value &&
          (repeatIntervalDays.value == null || repeatIntervalDays.value === 0)
        ) {
          repeatIntervalDays.value = 30;
        }
      }
      if (val === 'nth') {
        try {
          if (!everyNDayOfMonth.value) {
            const eventDate = options?.currentEventDate?.value ?? '';
            if (eventDate) {
              const parts = String(eventDate).split('-');
              if (parts.length === 3) {
                const day = Number(parts[2]);
                if (!isNaN(day) && day > 0) everyNDayOfMonth.value = day;
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }
  });

  /** Reset all repeat fields to defaults. */
  function reset() {
    repeatMode.value = 'oneTime';
    repeatCycleType.value = 'dayWeek';
    repeatDays.value = [];
    repeatIntervalDays.value = null;
    everyNDayOfMonth.value = null;
  }

  /**
   * Build the canonical `repeat` payload from current state.
   * Returns `null` when repeat mode is one-time.
   */
  function buildRepeatPayload(eventDate: string): Record<string, unknown> | null {
    if (repeatMode.value !== 'cyclic') return null;

    let outCycle = repeatCycleType.value as string;
    const repeatObj: Record<string, unknown> = {
      days: Array.isArray(repeatDays.value) ? [...repeatDays.value] : [],
    };

    if (repeatCycleType.value === 'interval') {
      if (everyNDayOfMonth.value) {
        outCycle = 'month';
        try {
          const parts = (eventDate || '').split('-');
          if (parts.length === 3) {
            parts[2] = String(everyNDayOfMonth.value).padStart(2, '0');
            repeatObj.eventDate = parts.join('-');
          } else {
            repeatObj.eventDate = eventDate || null;
          }
        } catch {
          repeatObj.eventDate = eventDate || null;
        }
      } else {
        outCycle = 'other';
        if (typeof repeatIntervalDays.value === 'number')
          repeatObj.intervalDays = repeatIntervalDays.value;
        repeatObj.eventDate = eventDate || null;
      }
    } else if (repeatCycleType.value === 'nth') {
      outCycle = 'month';
      try {
        const parts = (eventDate || '').split('-');
        if (parts.length === 3 && everyNDayOfMonth.value) {
          parts[2] = String(everyNDayOfMonth.value).padStart(2, '0');
          repeatObj.eventDate = parts.join('-');
        } else {
          repeatObj.eventDate = eventDate || null;
        }
      } catch {
        repeatObj.eventDate = eventDate || null;
      }
    } else {
      outCycle = repeatCycleType.value as string;
      repeatObj.eventDate = eventDate || null;
    }

    return { cycleType: outCycle, ...repeatObj };
  }

  /**
   * Load repeat state from an incoming task's `repeat` object (used when editing).
   * Pass `null` / `undefined` to reset to one-time.
   */
  function loadFromTask(
    task: {
      repeat?: Record<string, unknown> | null;
      eventDate?: string;
      date?: string;
    } | null,
  ) {
    if (!task || !task.repeat || typeof task.repeat !== 'object') {
      reset();
      return;
    }
    const rep = task.repeat as Record<string, any>;
    repeatMode.value = 'cyclic';
    const incomingCycle = (rep.cycleType as string) || 'dayWeek';

    if (incomingCycle === 'month') {
      repeatCycleType.value = 'nth';
      try {
        const ev = (rep.eventDate as string) || task.eventDate || task.date || null;
        if (ev) {
          const head = String(ev).split('T')[0] ?? '';
          const fromStr = dayOfMonthFromYmdString(head);
          if (fromStr != null) everyNDayOfMonth.value = fromStr;
          else {
            const d = new Date(ev);
            if (!isNaN(d.getTime())) everyNDayOfMonth.value = d.getDate();
          }
        }
      } catch {
        // ignore
      }
    } else if (incomingCycle === 'other' || incomingCycle === 'year') {
      repeatCycleType.value = 'interval';
      if (typeof rep.intervalDays === 'number') repeatIntervalDays.value = rep.intervalDays;
    } else {
      repeatCycleType.value = incomingCycle as 'dayWeek' | 'interval' | 'nth';
    }

    repeatDays.value = Array.isArray(rep.days) ? [...(rep.days as string[])] : [];

    if (typeof rep.intervalDays === 'number') repeatIntervalDays.value = rep.intervalDays;
    else if (repeatCycleType.value !== 'interval') repeatIntervalDays.value = null;
  }

  return {
    repeatMode,
    repeatOptions,
    repeatCycleType,
    repeatCycleOptions,
    weekDayOptions,
    repeatDays,
    everyNDayOfMonth,
    repeatIntervalDays,
    checkAllDays,
    clearDays,
    toggleDay,
    reset,
    buildRepeatPayload,
    loadFromTask,
  } as const;
}
