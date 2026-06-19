/** Default tag when no person/tag is selected. */
export const DEFAULT_PLANNING_TAG_ID = '__default__';

export type PlanningNoteStatus = 'important' | 'tricky' | 'inconvenient' | 'probable';

export const DEFAULT_PLANNING_NOTE_STATUS: PlanningNoteStatus = 'probable';

/** Lower number = more pessimistic (shown first on calendar). */
export const PLANNING_NOTE_STATUS_PRIORITY: Record<PlanningNoteStatus, number> = {
  important: 0,
  tricky: 1,
  inconvenient: 2,
  probable: 3,
};

export const PLANNING_NOTE_STATUS_ICONS: Record<PlanningNoteStatus, string> = {
  important: 'cancel',
  tricky: 'gesture',
  inconvenient: 'mood_bad',
  probable: 'check_circle',
};

export const PLANNING_NOTE_STATUS_COLORS: Record<PlanningNoteStatus, string> = {
  important: '#c62828',
  tricky: '#6a1b9a',
  inconvenient: '#ef6c00',
  probable: '#2e7d32',
};

export const PLANNING_NOTE_EMPTY_DISPLAY = '---';

export function formatPlanningNoteDisplayText(text?: string | null): string {
  const trimmed = String(text ?? '').trim();
  return trimmed || PLANNING_NOTE_EMPTY_DISPLAY;
}

export type PlanningTag = {
  id: string;
  label: string;
};

export type PlanningNote = {
  id: string;
  tagId: string;
  text: string;
  status: PlanningNoteStatus;
};

/** Session note state — `pendingRemoval` is not persisted. */
export type PlanningNoteState = PlanningNote & {
  pendingRemoval?: boolean;
};

export type PlanningDayEntry = {
  possible?: boolean;
  impossible?: boolean;
  notes?: PlanningNote[];
  /** @deprecated legacy single note — migrated on load */
  note?: string;
};

export type DayPlanningSchedule = {
  mode: 'notes';
  tags: PlanningTag[];
  days: Record<string, PlanningDayEntry>;
};

/** @deprecated use DayPlanningSchedule */
export type TodoMeetingSchedule = DayPlanningSchedule;

export type PlanningDayOverlayBadge = {
  text: string;
  status: PlanningNoteStatus;
  tagLabel: string;
};

export type PlanningDayOverlay = {
  possible?: boolean;
  impossible?: boolean;
  strikethrough: boolean;
  statuses: PlanningNoteStatus[];
  badges: PlanningDayOverlayBadge[];
};

export type PlanningDayEntryState = {
  possible: boolean;
  impossible: boolean;
  notes: PlanningNoteState[];
};
