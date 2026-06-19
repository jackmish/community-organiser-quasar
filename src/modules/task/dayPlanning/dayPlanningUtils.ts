import {
  DEFAULT_PLANNING_NOTE_STATUS,
  DEFAULT_PLANNING_TAG_ID,
  PLANNING_NOTE_STATUS_PRIORITY,
  type DayPlanningSchedule,
  type PlanningDayEntry,
  type PlanningDayEntryState,
  type PlanningDayOverlay,
  type PlanningDayOverlayBadge,
  type PlanningNote,
  type PlanningNoteStatus,
  type PlanningTag,
} from './dayPlanningTypes';

export function createPlanningId(): string {
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyPlanningDayEntry(): PlanningDayEntryState {
  return { possible: false, impossible: false, notes: [] };
}

export function normalizePlanningNote(raw: Partial<PlanningNote> | null | undefined): PlanningNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const text = String(raw.text ?? '').trim();
  const status = raw.status;
  const validStatus =
    status === 'important' ||
    status === 'tricky' ||
    status === 'inconvenient' ||
    status === 'probable'
      ? status
      : DEFAULT_PLANNING_NOTE_STATUS;
  return {
    id: String(raw.id || createPlanningId()),
    tagId: String(raw.tagId || DEFAULT_PLANNING_TAG_ID),
    text,
    status: validStatus,
  };
}

export function normalizePlanningDayEntry(entry?: PlanningDayEntry | null): PlanningDayEntryState {
  const notes: PlanningNote[] = [];
  if (Array.isArray(entry?.notes)) {
    for (const item of entry.notes) {
      const note = normalizePlanningNote(item);
      if (note) notes.push(note);
    }
  }
  const legacyNote = String(entry?.note || '').trim();
  if (legacyNote && notes.length === 0) {
    notes.push({
      id: createPlanningId(),
      tagId: DEFAULT_PLANNING_TAG_ID,
      text: legacyNote,
      status: DEFAULT_PLANNING_NOTE_STATUS,
    });
  }
  return {
    possible: Boolean(entry?.possible),
    impossible: Boolean(entry?.impossible),
    notes,
  };
}

export function normalizePlanningTags(tags: PlanningTag[] | null | undefined): PlanningTag[] {
  if (!Array.isArray(tags)) return [];
  const out: PlanningTag[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const label = String(tag?.label || '').trim();
    const id = String(tag?.id || '').trim();
    if (!label || !id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

export function resolveTagLabel(tagId: string, tags: PlanningTag[]): string {
  if (tagId === DEFAULT_PLANNING_TAG_ID) return '';
  return tags.find((t) => t.id === tagId)?.label || '';
}

export function getMostPessimisticStatus(notes: PlanningNote[]): PlanningNoteStatus | null {
  if (!notes.length) return null;
  let best: PlanningNoteStatus = notes[0]!.status;
  let bestRank = PLANNING_NOTE_STATUS_PRIORITY[best];
  for (const note of notes) {
    const rank = PLANNING_NOTE_STATUS_PRIORITY[note.status];
    if (rank < bestRank) {
      best = note.status;
      bestRank = rank;
    }
  }
  return best;
}

export function getTopPriorityNotes(notes: PlanningNote[]): PlanningNote[] {
  const topStatus = getMostPessimisticStatus(notes);
  if (!topStatus) return [];
  return notes.filter((n) => n.status === topStatus);
}

/** All notes sorted from most pessimistic status to least. */
export function sortNotesByPriority(notes: PlanningNote[]): PlanningNote[] {
  return [...notes].sort(
    (a, b) => PLANNING_NOTE_STATUS_PRIORITY[a.status] - PLANNING_NOTE_STATUS_PRIORITY[b.status],
  );
}

export function buildPlanningDayOverlay(
  entry: PlanningDayEntryState,
  tags: PlanningTag[],
): PlanningDayOverlay | null {
  const sortedNotes = sortNotesByPriority(entry.notes);
  const topStatus = getMostPessimisticStatus(entry.notes);
  const hasMarks = entry.possible || entry.impossible;
  if (!sortedNotes.length && !hasMarks) return null;

  const statuses = sortedNotes.length
    ? [...new Set(sortedNotes.map((note) => note.status))].sort(
        (a, b) => PLANNING_NOTE_STATUS_PRIORITY[a] - PLANNING_NOTE_STATUS_PRIORITY[b],
      )
    : [];

  const badges: PlanningDayOverlayBadge[] = sortedNotes.map((note) => ({
    text: note.text,
    status: note.status,
    tagLabel: resolveTagLabel(note.tagId, tags),
  }));

  return {
    ...(entry.possible ? { possible: true } : {}),
    ...(entry.impossible ? { impossible: true } : {}),
    strikethrough: topStatus === 'important',
    statuses,
    badges,
  };
}

export function toPersistedPlanningDayEntry(entry: PlanningDayEntryState): PlanningDayEntry | null {
  const out: PlanningDayEntry = {};
  if (entry.possible) out.possible = true;
  if (entry.impossible) out.impossible = true;
  if (entry.notes.length > 0) {
    out.notes = entry.notes.map((n) => ({
      id: n.id,
      tagId: n.tagId,
      text: n.text,
      status: n.status,
    }));
  }
  if (!out.possible && !out.impossible && !out.notes?.length) return null;
  return out;
}

export function buildDayPlanningSchedule(
  tags: PlanningTag[],
  days: Record<string, PlanningDayEntryState>,
  options?: { persistNotesMode?: boolean },
): DayPlanningSchedule | undefined {
  const persistedDays: Record<string, PlanningDayEntry> = {};
  for (const [date, entry] of Object.entries(days)) {
    const persisted = toPersistedPlanningDayEntry(entry);
    if (persisted) persistedDays[date] = persisted;
  }
  const normalizedTags = normalizePlanningTags(tags);
  const hasContent =
    normalizedTags.length > 0 || Object.keys(persistedDays).length > 0;
  if (!hasContent && !options?.persistNotesMode) return undefined;
  return {
    mode: 'notes',
    tags: normalizedTags,
    days: persistedDays,
  };
}

/** Task uses extended (notes) planning mode. */
export function scheduleHasPlanningData(schedule: DayPlanningSchedule | null | undefined): boolean {
  return schedule?.mode === 'notes';
}

/** Task has tags, day marks, or notes worth showing in preview. */
export function scheduleHasPlanningContent(schedule: DayPlanningSchedule | null | undefined): boolean {
  if (schedule?.mode !== 'notes') return false;
  if (normalizePlanningTags(schedule.tags).length > 0) return true;
  if (!schedule.days) return false;
  return Object.values(schedule.days).some((entry) => {
    const normalized = normalizePlanningDayEntry(entry);
    return normalized.possible || normalized.impossible || normalized.notes.length > 0;
  });
}

export function clonePlanningSession(
  schedule: DayPlanningSchedule | null | undefined,
): { tags: PlanningTag[]; days: Record<string, PlanningDayEntryState> } {
  const tags = normalizePlanningTags(schedule?.tags);
  const days: Record<string, PlanningDayEntryState> = {};
  if (schedule?.days) {
    for (const [date, entry] of Object.entries(schedule.days)) {
      const normalized = normalizePlanningDayEntry(entry);
      days[date] = {
        possible: normalized.possible,
        impossible: normalized.impossible,
        notes: normalized.notes.map((n) => ({ ...n })),
      };
    }
  }
  return { tags, days };
}
