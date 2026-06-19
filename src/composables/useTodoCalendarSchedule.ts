import { computed, ref, shallowRef } from 'vue';

/** Sentinel id for scheduling a not-yet-saved task from the add form. */
export const TODO_SCHEDULE_DRAFT_ID = '__draft__';

/** How the calendar pick UI behaves: day only, or day with notes. */
export type TodoSchedulePickMode = 'day' | 'notes';

export const DEFAULT_TODO_SCHEDULE_PICK_MODE: TodoSchedulePickMode = 'day';

export type TodoMeetingDayEntry = {
  possible?: boolean;
  impossible?: boolean;
  note?: string;
};

/** Normalized in-memory day entry (all fields required for strict TS). */
type TodoMeetingDayEntryState = {
  possible: boolean;
  impossible: boolean;
  note: string;
};

function emptyDayEntry(): TodoMeetingDayEntryState {
  return { possible: false, impossible: false, note: '' };
}

function normalizeDayEntry(entry?: TodoMeetingDayEntry): TodoMeetingDayEntryState {
  return {
    possible: Boolean(entry?.possible),
    impossible: Boolean(entry?.impossible),
    note: String(entry?.note || ''),
  };
}

function toPersistedDayEntry(entry: TodoMeetingDayEntryState): TodoMeetingDayEntry {
  const out: TodoMeetingDayEntry = {};
  if (entry.possible) out.possible = true;
  if (entry.impossible) out.impossible = true;
  const note = entry.note.trim();
  if (note) out.note = note;
  return out;
}

export type TodoMeetingSchedule = {
  mode: 'notes';
  days: Record<string, TodoMeetingDayEntry>;
};

/** Minimal task fields needed to schedule a Todo on the calendar. */
export type TodoScheduleTask = {
  id: string;
  name?: string | undefined;
  eventTime?: string | undefined;
  eventDate?: string | undefined;
  date?: string | undefined;
  type_id?: string | undefined;
  meetingSchedule?: TodoMeetingSchedule | null | undefined;
  repeat?: Record<string, unknown> | null | undefined;
  [key: string]: unknown;
};

const active = ref(false);
const isDraft = ref(false);
const sourceTask = shallowRef<TodoScheduleTask | null>(null);
const pickedDate = ref('');
const pickMode = ref<TodoSchedulePickMode>(DEFAULT_TODO_SCHEDULE_PICK_MODE);
const scheduleHour = ref<number | null>(null);
const scheduleMinute = ref<number | null>(null);
const dayEntries = ref<Record<string, TodoMeetingDayEntryState>>({});
const editingDay = ref('');
/** Bumped on each new schedule session so mode toggles re-sync to defaults. */
const sessionKey = ref(0);

function cloneDayEntries(
  days: Record<string, TodoMeetingDayEntry> | undefined | null,
): Record<string, TodoMeetingDayEntryState> {
  if (!days) return {};
  const out: Record<string, TodoMeetingDayEntryState> = {};
  for (const [date, entry] of Object.entries(days)) {
    out[date] = normalizeDayEntry(entry);
  }
  return out;
}

function resetDayNotes() {
  dayEntries.value = {};
  editingDay.value = '';
}

function loadMeetingScheduleFromTask(task: TodoScheduleTask | null | undefined) {
  const schedule = task?.meetingSchedule;
  if (schedule?.mode === 'notes' && schedule.days && Object.keys(schedule.days).length > 0) {
    dayEntries.value = cloneDayEntries(schedule.days);
    pickMode.value = 'notes';
    return;
  }
  resetDayNotes();
  pickMode.value = DEFAULT_TODO_SCHEDULE_PICK_MODE;
}

function taskHasMeetingScheduleNotes(task: TodoScheduleTask | null | undefined): boolean {
  const schedule = task?.meetingSchedule;
  return Boolean(
    schedule?.mode === 'notes' &&
      schedule.days &&
      Object.keys(schedule.days).length > 0,
  );
}

/** Shared state: schedule a Todo via the main calendar (preview or edit). */
export function useTodoCalendarSchedule() {
  const hasPickedDate = computed(() => Boolean(pickedDate.value.trim()));

  const scheduleDayMarks = computed(() => {
    const marks: Record<string, { possible?: boolean; impossible?: boolean }> = {};
    for (const [date, entry] of Object.entries(dayEntries.value)) {
      if (entry.possible || entry.impossible) {
        marks[date] = {
          possible: Boolean(entry.possible),
          impossible: Boolean(entry.impossible),
        };
      }
    }
    return marks;
  });

  function ensureDayEntry(date: string): TodoMeetingDayEntryState {
    const d = String(date || '').trim();
    if (!d) return emptyDayEntry();
    const existing = dayEntries.value[d];
    if (existing) return existing;
    const created = emptyDayEntry();
    dayEntries.value = {
      ...dayEntries.value,
      [d]: created,
    };
    return created;
  }

  function openDayEditor(date: string) {
    const d = String(date || '').trim();
    if (!d) return;
    ensureDayEntry(d);
    editingDay.value = d;
  }

  function setDayPossible(date: string, value: boolean) {
    const d = String(date || '').trim();
    if (!d) return;
    const entry = ensureDayEntry(d);
    dayEntries.value = {
      ...dayEntries.value,
      [d]: {
        ...entry,
        possible: value,
        impossible: value ? false : entry.impossible,
      },
    };
  }

  function setDayImpossible(date: string, value: boolean) {
    const d = String(date || '').trim();
    if (!d) return;
    const entry = ensureDayEntry(d);
    dayEntries.value = {
      ...dayEntries.value,
      [d]: {
        ...entry,
        impossible: value,
        possible: value ? false : entry.possible,
      },
    };
  }

  function setDayNote(date: string, note: string) {
    const d = String(date || '').trim();
    if (!d) return;
    const entry = ensureDayEntry(d);
    dayEntries.value = {
      ...dayEntries.value,
      [d]: {
        ...entry,
        note,
      },
    };
  }

  function buildMeetingSchedule(): TodoMeetingSchedule | undefined {
    if (pickMode.value !== 'notes') return undefined;
    const days: Record<string, TodoMeetingDayEntry> = {};
    for (const [date, entry] of Object.entries(dayEntries.value)) {
      const persisted = toPersistedDayEntry(entry);
      if (persisted.possible || persisted.impossible || persisted.note) {
        days[date] = persisted;
      }
    }
    if (Object.keys(days).length === 0) return undefined;
    return { mode: 'notes', days };
  }

  function hasMeetingNotesData(): boolean {
    return Boolean(buildMeetingSchedule());
  }

  function start(task: TodoScheduleTask) {
    if (!task?.id) return;
    isDraft.value = false;
    sourceTask.value = task;
    pickedDate.value = '';
    scheduleHour.value = null;
    scheduleMinute.value = null;
    sessionKey.value += 1;
    loadMeetingScheduleFromTask(task);
    if (!taskHasMeetingScheduleNotes(task)) {
      pickMode.value = DEFAULT_TODO_SCHEDULE_PICK_MODE;
    }
    active.value = true;
  }

  /** Start calendar pick for a task that has not been saved yet (add form). */
  function startDraft(task: Omit<TodoScheduleTask, 'id'>) {
    isDraft.value = true;
    sourceTask.value = { ...task, id: TODO_SCHEDULE_DRAFT_ID };
    pickedDate.value = '';
    scheduleHour.value = null;
    scheduleMinute.value = null;
    sessionKey.value += 1;
    loadMeetingScheduleFromTask(sourceTask.value);
    if (!taskHasMeetingScheduleNotes(sourceTask.value)) {
      pickMode.value = DEFAULT_TODO_SCHEDULE_PICK_MODE;
    }
    active.value = true;
  }

  function cancel() {
    active.value = false;
    isDraft.value = false;
    sourceTask.value = null;
    pickedDate.value = '';
    pickMode.value = DEFAULT_TODO_SCHEDULE_PICK_MODE;
    scheduleHour.value = null;
    scheduleMinute.value = null;
    resetDayNotes();
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
    isDraft,
    sourceTask,
    pickedDate,
    pickMode,
    scheduleHour,
    scheduleMinute,
    dayEntries,
    editingDay,
    sessionKey,
    hasPickedDate,
    scheduleDayMarks,
    start,
    startDraft,
    cancel,
    pickDay,
    openDayEditor,
    setDayPossible,
    setDayImpossible,
    setDayNote,
    buildMeetingSchedule,
    hasMeetingNotesData,
    buildEventTime,
  };
}

/** Module singleton — DayOrganiser + TaskPreview + AddTaskForm share one schedule session. */
export const todoCalendarSchedule = useTodoCalendarSchedule();
