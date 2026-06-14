/** Named timer notes — use these instead of raw Hz values. */
export const Note = {
  REST: 'REST',
  C4: 'C4',
  D4: 'D4',
  E4: 'E4',
  F4: 'F4',
  G4: 'G4',
  A4: 'A4',
  C5: 'C5',
  E5: 'E5',
  G5: 'G5',
  C6: 'C6',
} as const;

export type TimerNote = (typeof Note)[keyof typeof Note];

export interface MelodyStep {
  note: TimerNote;
  /** Length in beat units; each trailing `-` in notation adds one unit. */
  beats: number;
}

export const ALARM_BEAT_SEC = 0.28;

const MIDI_BY_NOTE: Record<Exclude<TimerNote, typeof Note.REST>, number> = {
  [Note.C4]: 60,
  [Note.D4]: 62,
  [Note.E4]: 64,
  [Note.F4]: 65,
  [Note.G4]: 67,
  [Note.A4]: 69,
  [Note.C5]: 72,
  [Note.E5]: 76,
  [Note.G5]: 79,
  [Note.C6]: 84,
};

export function isRestNote(note: TimerNote): boolean {
  return note === Note.REST;
}

export function noteToFrequency(note: TimerNote): number | null {
  if (isRestNote(note)) return null;
  const midi = MIDI_BY_NOTE[note as Exclude<TimerNote, typeof Note.REST>];
  return 440 * 2 ** ((midi - 69) / 12);
}

export function melodyStep(note: TimerNote, beats = 1): MelodyStep {
  return { note, beats };
}

export function melodyStepDurationSec(step: MelodyStep): number {
  return step.beats * ALARM_BEAT_SEC;
}
