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
const scheduleHour = ref(9);
const scheduleMinute = ref(0);

/** Shared state: schedule a Todo via the main calendar (preview or edit). */
export function useTodoCalendarSchedule() {
  const hasPickedDate = computed(() => Boolean(pickedDate.value.trim()));

  function start(task: TodoScheduleTask) {
    if (!task?.id) return;
    sourceTask.value = task;
    pickedDate.value = '';
    const t = String(task.eventTime || '').trim();
    if (t && /^\d{1,2}:\d{2}/.test(t)) {
      const [h, m] = t.split(':');
      scheduleHour.value = Math.min(23, Math.max(0, Number(h) || 9));
      scheduleMinute.value = Math.min(59, Math.max(0, Number(m) || 0));
    } else {
      scheduleHour.value = 9;
      scheduleMinute.value = 0;
    }
    active.value = true;
  }

  function cancel() {
    active.value = false;
    sourceTask.value = null;
    pickedDate.value = '';
  }

  function pickDay(date: string) {
    const d = String(date || '').trim();
    if (!d) return;
    pickedDate.value = d;
  }

  function buildEventTime(): string {
    const h = Math.min(23, Math.max(0, Number(scheduleHour.value) || 0));
    const m = Math.min(59, Math.max(0, Number(scheduleMinute.value) || 0));
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
