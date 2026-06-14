import { Note, melodyStep, type MelodyStep } from './clockTimerNotes';

/** Ascending arpeggio — original alarm pattern. */
export const CLASSIC_ALARM_MELODY: MelodyStep[] = [
  melodyStep(Note.C5),
  melodyStep(Note.E5),
  melodyStep(Note.G5),
  melodyStep(Note.C6, 1.5),
  melodyStep(Note.G5),
  melodyStep(Note.E5),
  melodyStep(Note.C5, 1.5),
];

/**
 * c,d,e-,d,e,f-,e,f,g---,a,f,g,d,e,c,c---
 * `-` = longer note (extra beat), not a rest.
 * Use `melodyStep(Note.REST, beats)` for a silent pause.
 */
export const GENTLE_ALARM_MELODY: MelodyStep[] = [
  melodyStep(Note.C4,0.5),
  melodyStep(Note.F4,0.5),
  melodyStep(Note.E4,1 ),
  melodyStep(Note.D4,0.5),
  melodyStep(Note.G4,0.5),
  melodyStep(Note.F4, 1),
  melodyStep(Note.E4,0.5),
  melodyStep(Note.A4,0.5),
  melodyStep(Note.G4,1),
  melodyStep(Note.A4,0.5),
  melodyStep(Note.G4,0.5),
  melodyStep(Note.A4,1),
  melodyStep(Note.G4,0.5),
  melodyStep(Note.C4,0.5),
  melodyStep(Note.C5,1),
  melodyStep(Note.REST,1),
  melodyStep(Note.C4,1),
  melodyStep(Note.REST,1),
  melodyStep(Note.C5,1),
  melodyStep(Note.REST,1),
  melodyStep(Note.C4,1),
  melodyStep(Note.REST,1),
  melodyStep(Note.C5,1),
  melodyStep(Note.REST,2),
  

];

export const CLOCK_TIMER_ALARM_MELODY_IDS = ['classic', 'gentle'] as const;

export type ClockTimerAlarmMelodyId = (typeof CLOCK_TIMER_ALARM_MELODY_IDS)[number];

export const CLOCK_TIMER_ALARM_MELODIES: Record<ClockTimerAlarmMelodyId, MelodyStep[]> = {
  classic: CLASSIC_ALARM_MELODY,
  gentle: GENTLE_ALARM_MELODY,
};
