import { computed, ref, shallowRef } from 'vue';
import {
  DEFAULT_PLANNING_NOTE_STATUS,
  DEFAULT_PLANNING_TAG_ID,
  type DayPlanningSchedule,
  type PlanningDayEntryState,
  type PlanningNoteStatus,
  type PlanningTag,
  type TodoMeetingSchedule,
} from 'src/modules/task/dayPlanning/dayPlanningTypes';
import {
  buildDayPlanningSchedule,
  buildPlanningDayOverlay,
  clonePlanningSession,
  createPlanningId,
  emptyPlanningDayEntry,
  orderPlanningNotesForDisplay,
  mergeImportedPlanningTags,
  normalizePlanningTags,
} from 'src/modules/task/dayPlanning/dayPlanningUtils';
import type { PlanningDayOverlay } from 'src/modules/task/dayPlanning/dayPlanningTypes';

/** Sentinel id for scheduling a not-yet-saved task from the add form. */
export const TODO_SCHEDULE_DRAFT_ID = '__draft__';

/** How the calendar pick UI behaves: day only, or day with notes. */
export type TodoSchedulePickMode = 'day' | 'notes';

export const DEFAULT_TODO_SCHEDULE_PICK_MODE: TodoSchedulePickMode = 'day';

const LAST_TODO_SCHEDULE_PICK_MODE_KEY = 'co21:todo-schedule-pick-mode';

let rememberedPickMode: TodoSchedulePickMode | null = null;

function readLastPickMode(): TodoSchedulePickMode {
  if (rememberedPickMode) return rememberedPickMode;
  if (typeof localStorage === 'undefined') return DEFAULT_TODO_SCHEDULE_PICK_MODE;
  try {
    const stored = localStorage.getItem(LAST_TODO_SCHEDULE_PICK_MODE_KEY);
    if (stored === 'notes' || stored === 'day') {
      rememberedPickMode = stored;
      return stored;
    }
  } catch {
    void 0;
  }
  return DEFAULT_TODO_SCHEDULE_PICK_MODE;
}

export function rememberTodoSchedulePickMode(mode: TodoSchedulePickMode) {
  rememberedPickMode = mode;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LAST_TODO_SCHEDULE_PICK_MODE_KEY, mode);
  } catch {
    void 0;
  }
}

export function resetRememberedTodoSchedulePickMode() {
  rememberedPickMode = null;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LAST_TODO_SCHEDULE_PICK_MODE_KEY);
  } catch {
    void 0;
  }
}

export type {
  DayPlanningSchedule,
  PlanningDayOverlay,
  PlanningNote,
  PlanningNoteStatus,
  PlanningTag,
  TodoMeetingSchedule,
} from 'src/modules/task/dayPlanning/dayPlanningTypes';

export { DEFAULT_PLANNING_TAG_ID, PLANNING_NOTE_STATUS_ICONS } from 'src/modules/task/dayPlanning/dayPlanningTypes';

/** Minimal task fields needed to schedule a Todo on the calendar. */
export type TodoScheduleTask = {
  id: string;
  name?: string | undefined;
  description?: string | undefined;
  eventTime?: string | undefined;
  eventDate?: string | undefined;
  date?: string | undefined;
  type_id?: string | undefined;
  meetingSchedule?: DayPlanningSchedule | null | undefined;
  dayPlanning?: DayPlanningSchedule | null | undefined;
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
const scheduleDescription = ref('');
const planningTags = ref<PlanningTag[]>([]);
const selectedTagId = ref(DEFAULT_PLANNING_TAG_ID);
const dayEntries = ref<Record<string, PlanningDayEntryState>>({});
const editingDay = ref('');
const sessionKey = ref(0);

function resolveTaskPlanning(task: TodoScheduleTask | null | undefined): DayPlanningSchedule | null | undefined {
  return task?.dayPlanning ?? task?.meetingSchedule ?? null;
}

function resetPlanningSession() {
  planningTags.value = [];
  selectedTagId.value = DEFAULT_PLANNING_TAG_ID;
  dayEntries.value = {};
  editingDay.value = '';
}

function loadPlanningFromTask(task: TodoScheduleTask | null | undefined) {
  const schedule = resolveTaskPlanning(task);
  if (schedule?.mode === 'notes') {
    const cloned = clonePlanningSession(schedule);
    planningTags.value = cloned.tags;
    dayEntries.value = cloned.days;
    pickMode.value = 'notes';
    return;
  }
  resetPlanningSession();
  pickMode.value = readLastPickMode();
}

function parseEventTimeParts(eventTime?: string | null): { hour: number; minute: number } | null {
  const time = String(eventTime || '').trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

function resolveTaskScheduleDate(task: TodoScheduleTask | null | undefined): string {
  return String(task?.eventDate || task?.date || '').trim();
}

function prefillScheduleFromTask(task: TodoScheduleTask | null | undefined) {
  const date = resolveTaskScheduleDate(task);
  if (date) pickedDate.value = date;
  scheduleDescription.value = String(task?.description ?? '').trim();
  const timeParts = parseEventTimeParts(task?.eventTime);
  if (timeParts) {
    scheduleHour.value = timeParts.hour;
    scheduleMinute.value = timeParts.minute;
  }
}

/** Shared state: schedule a Todo via the main calendar (preview or edit). */
export function useTodoCalendarSchedule() {
  const hasPickedDate = computed(() => Boolean(pickedDate.value.trim()));

  const scheduleDayMarks = computed(() => {
    if (pickMode.value !== 'notes') return {};
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

  const planningDayOverlays = computed(() => {
    if (pickMode.value !== 'notes' || !active.value) return {} as Record<string, PlanningDayOverlay>;
    const overlays: Record<string, PlanningDayOverlay> = {};
    for (const [date, entry] of Object.entries(dayEntries.value)) {
      const overlay = buildPlanningDayOverlay(entry, planningTags.value);
      if (overlay) overlays[date] = overlay;
    }
    return overlays;
  });

  function ensureDayEntry(date: string): PlanningDayEntryState {
    const d = String(date || '').trim();
    if (!d) return emptyPlanningDayEntry();
    const existing = dayEntries.value[d];
    if (existing) return existing;
    const created = emptyPlanningDayEntry();
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

  function resolveInitialPlanningEditorDay(task: TodoScheduleTask | null | undefined): string {
    const date = pickedDate.value.trim() || resolveTaskScheduleDate(task);
    if (date) return date;
    const firstDay = Object.keys(dayEntries.value).sort()[0];
    return firstDay || '';
  }

  function syncPlanningEditorDay(task: TodoScheduleTask | null | undefined = sourceTask.value) {
    if (pickMode.value !== 'notes') return;
    const day = resolveInitialPlanningEditorDay(task);
    if (day) openDayEditor(day);
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

  function setSelectedTagId(tagId: string) {
    selectedTagId.value = tagId || DEFAULT_PLANNING_TAG_ID;
  }

  function addPlanningTag(label: string): PlanningTag | null {
    const trimmed = String(label || '').trim();
    if (!trimmed) return null;
    const exists = planningTags.value.some(
      (t) => t.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      const found = planningTags.value.find((t) => t.label.toLowerCase() === trimmed.toLowerCase());
      if (found) selectedTagId.value = found.id;
      return found ?? null;
    }
    const tag: PlanningTag = { id: createPlanningId(), label: trimmed };
    planningTags.value = [...planningTags.value, tag];
    selectedTagId.value = tag.id;
    return tag;
  }

  function updatePlanningTag(tagId: string, label: string) {
    const id = String(tagId || '').trim();
    const trimmed = String(label || '').trim();
    if (!id || !trimmed) return;
    const duplicate = planningTags.value.find(
      (t) => t.id !== id && t.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) return;
    planningTags.value = planningTags.value.map((t) =>
      t.id === id ? { ...t, label: trimmed } : t,
    );
  }

  function removePlanningTag(tagId: string) {
    const id = String(tagId || '').trim();
    if (!id) return;
    planningTags.value = planningTags.value.filter((t) => t.id !== id);
    if (selectedTagId.value === id) {
      selectedTagId.value = DEFAULT_PLANNING_TAG_ID;
    }
    const nextDays: Record<string, PlanningDayEntryState> = {};
    for (const [date, entry] of Object.entries(dayEntries.value)) {
      const notes = entry.notes.map((note) =>
        note.tagId === id ? { ...note, tagId: DEFAULT_PLANNING_TAG_ID } : note,
      );
      nextDays[date] = notes === entry.notes ? entry : { ...entry, notes };
    }
    dayEntries.value = nextDays;
  }

  function addPlanningNote(date: string, text: string, status: PlanningNoteStatus = DEFAULT_PLANNING_NOTE_STATUS) {
    const d = String(date || '').trim();
    const trimmed = String(text || '').trim();
    if (!d) return;
    const entry = ensureDayEntry(d);
    const note = {
      id: createPlanningId(),
      tagId: selectedTagId.value || DEFAULT_PLANNING_TAG_ID,
      text: trimmed,
      status,
    };
    dayEntries.value = {
      ...dayEntries.value,
      [d]: {
        ...entry,
        notes: orderPlanningNotesForDisplay([...entry.notes, note]),
      },
    };
  }

  function softRemovePlanningNote(date: string, noteId: string) {
    const d = String(date || '').trim();
    const id = String(noteId || '').trim();
    if (!d || !id) return;
    const entry = ensureDayEntry(d);
    const notes = entry.notes.map((note) =>
      note.id === id ? { ...note, pendingRemoval: true } : note,
    );
    dayEntries.value = {
      ...dayEntries.value,
      [d]: { ...entry, notes: orderPlanningNotesForDisplay(notes) },
    };
  }

  function restorePlanningNote(date: string, noteId: string) {
    const d = String(date || '').trim();
    const id = String(noteId || '').trim();
    if (!d || !id) return;
    const entry = ensureDayEntry(d);
    const notes = entry.notes.map((note) =>
      note.id === id ? { ...note, pendingRemoval: false } : note,
    );
    dayEntries.value = {
      ...dayEntries.value,
      [d]: { ...entry, notes: orderPlanningNotesForDisplay(notes) },
    };
  }

  function updatePlanningNote(
    date: string,
    noteId: string,
    text: string,
    status: PlanningNoteStatus,
  ) {
    const d = String(date || '').trim();
    const id = String(noteId || '').trim();
    if (!d || !id) return;
    const entry = ensureDayEntry(d);
    const trimmed = String(text ?? '').trim();
    const notes = entry.notes.map((note) =>
      note.id === id ? { ...note, text: trimmed, status, pendingRemoval: false } : note,
    );
    dayEntries.value = {
      ...dayEntries.value,
      [d]: { ...entry, notes: orderPlanningNotesForDisplay(notes) },
    };
  }

  function importPlanningTags(tags: PlanningTag[]) {
    planningTags.value = mergeImportedPlanningTags(planningTags.value, tags);
  }

  function buildDayPlanning(): DayPlanningSchedule | undefined {
    if (pickMode.value !== 'notes') return undefined;
    return buildDayPlanningSchedule(planningTags.value, dayEntries.value, {
      persistNotesMode: true,
    });
  }

  /** @deprecated alias */
  function buildMeetingSchedule(): DayPlanningSchedule | undefined {
    return buildDayPlanning();
  }

  function hasPlanningNotesData(): boolean {
    return pickMode.value === 'notes';
  }

  /** @deprecated alias */
  function hasMeetingNotesData(): boolean {
    return hasPlanningNotesData();
  }

  function start(task: TodoScheduleTask) {
    if (!task?.id) return;
    isDraft.value = false;
    sourceTask.value = task;
    pickedDate.value = '';
    scheduleHour.value = null;
    scheduleMinute.value = null;
    scheduleDescription.value = '';
    sessionKey.value += 1;
    loadPlanningFromTask(task);
    prefillScheduleFromTask(task);
    active.value = true;
    syncPlanningEditorDay(task);
  }

  function startDraft(task: Omit<TodoScheduleTask, 'id'>) {
    isDraft.value = true;
    sourceTask.value = { ...task, id: TODO_SCHEDULE_DRAFT_ID };
    pickedDate.value = '';
    scheduleHour.value = null;
    scheduleMinute.value = null;
    scheduleDescription.value = '';
    sessionKey.value += 1;
    loadPlanningFromTask(sourceTask.value);
    prefillScheduleFromTask(sourceTask.value);
    active.value = true;
    syncPlanningEditorDay(sourceTask.value);
  }

  function cancel() {
    active.value = false;
    isDraft.value = false;
    sourceTask.value = null;
    pickedDate.value = '';
    pickMode.value = readLastPickMode();
    scheduleHour.value = null;
    scheduleMinute.value = null;
    scheduleDescription.value = '';
    resetPlanningSession();
  }

  function pickDay(date: string) {
    const d = String(date || '').trim();
    if (!d) return;
    pickedDate.value = d;
  }

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
    scheduleDescription,
    planningTags,
    selectedTagId,
    dayEntries,
    editingDay,
    sessionKey,
    hasPickedDate,
    scheduleDayMarks,
    planningDayOverlays,
    start,
    startDraft,
    cancel,
    pickDay,
    openDayEditor,
    syncPlanningEditorDay,
    setDayPossible,
    setDayImpossible,
    setSelectedTagId,
    addPlanningTag,
    updatePlanningTag,
    removePlanningTag,
    addPlanningNote,
    softRemovePlanningNote,
    restorePlanningNote,
    updatePlanningNote,
    importPlanningTags,
    buildDayPlanning,
    buildMeetingSchedule,
    hasPlanningNotesData,
    hasMeetingNotesData,
    buildEventTime,
  };
}

export const todoCalendarSchedule = useTodoCalendarSchedule();
