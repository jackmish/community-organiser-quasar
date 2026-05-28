import { computed, ref, shallowRef } from 'vue';

/** Minimal task fields needed to schedule a Todo on the calendar. */
export type TodoScheduleTask = {
  id: string;
  name?: string | undefined;
  eventTime?: string | undefined;
  eventDate?: string | undefined;
  date?: string | undefined;
  type_id?: string | undefined;
  [key: string]: unknown;
};

const active = ref(false);
const sourceTask = shallowRef<TodoScheduleTask | null>(null);
const pickedDate = ref('');
const scheduleHour = ref<number | null>(null);
const scheduleMinute = ref<number | null>(null);

/** Shared state: schedule a Todo via the main calendar (preview or edit). */
export function useTodoCalendarSchedule() {
  const hasPickedDate = computed(() => Boolean(pickedDate.value.trim()));

  function start(task: TodoScheduleTask) {
    if (!task?.id) return;
    sourceTask.value = task;
    pickedDate.value = '';
    scheduleHour.value = null;
    scheduleMinute.value = null;
    active.value = true;
  }

  function cancel() {
    active.value = false;
    sourceTask.value = null;
    pickedDate.value = '';
    scheduleHour.value = null;
    scheduleMinute.value = null;
  }

  function pickDay(date: string) {
    const d = String(date || '').trim();
    if (!d) return;
    pickedDate.value = d;
  }

  /** HH:mm when both fields are set; otherwise empty (all-day on that date). */
  function buildEventTime(): string {
    if (scheduleHour.value == null || scheduleMinute.value == null) return '';
    const h = Math.min(23, Math.max(0, Number(scheduleHour.value)));
    const m = Math.min(59, Math.max(0, Number(scheduleMinute.value)));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return {
    active,
    sourceTask,
    pickedDate,
    scheduleHour,
    scheduleMinute,
    hasPickedDate,
    start,
    cancel,
    pickDay,
    buildEventTime,
  };
}

/** Module singleton — DayOrganiser + TaskPreview + AddTaskForm share one schedule session. */
export const todoCalendarSchedule = useTodoCalendarSchedule();
