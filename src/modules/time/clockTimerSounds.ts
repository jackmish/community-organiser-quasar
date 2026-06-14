import {
  CLOCK_TIMER_ALARM_MELODIES,
  type ClockTimerAlarmMelodyId,
} from './clockTimerMelodies';
import { getClockTimerAlarmMelodyId } from './clockTimerMelodySettings';
import {
  Note,
  isRestNote,
  melodyStepDurationSec,
  noteToFrequency,
  type MelodyStep,
} from './clockTimerNotes';

let audioCtx: AudioContext | null = null;
let alarmStopFn: (() => void) | null = null;

const PIANO_PARTIALS: ReadonlyArray<{ ratio: number; gain: number }> = [
  { ratio: 1, gain: 1 },
  { ratio: 2, gain: 0.45 },
  { ratio: 3, gain: 0.22 },
  { ratio: 4, gain: 0.12 },
  { ratio: 5, gain: 0.06 },
];

export const CLOCK_TIMER_COUNTDOWN_SECONDS = 5;

const COUNTDOWN_BEEP_MAX_SECONDS = CLOCK_TIMER_COUNTDOWN_SECONDS;
const COUNTDOWN_MIN_VOLUME = 0.06;
const COUNTDOWN_MAX_VOLUME = 0.78;
const ALARM_MIN_VOLUME = 0.32;
const ALARM_MAX_VOLUME = 0.82;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function resumeClockTimerAudio(): void {
  getAudioContext();
}

function playPianoNote(
  ctx: AudioContext,
  frequency: number,
  durationSec: number,
  volume: number,
): void {
  const start = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  masterGain.gain.setValueAtTime(0.0001, start);
  masterGain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), start + 0.01);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

  for (const partial of PIANO_PARTIALS) {
    const osc = ctx.createOscillator();
    const partialGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency * partial.ratio;
    partialGain.gain.value = partial.gain;
    osc.connect(partialGain);
    partialGain.connect(masterGain);
    osc.start(start);
    osc.stop(start + durationSec + 0.08);
  }
}

function countdownBeepVolume(secondsLeft: number): number {
  const clamped = Math.max(1, Math.min(COUNTDOWN_BEEP_MAX_SECONDS, secondsLeft));
  const beepIndex = COUNTDOWN_BEEP_MAX_SECONDS - clamped + 1;
  const progress = beepIndex / COUNTDOWN_BEEP_MAX_SECONDS;
  const curved = progress ** 1.35;
  return COUNTDOWN_MIN_VOLUME + curved * (COUNTDOWN_MAX_VOLUME - COUNTDOWN_MIN_VOLUME);
}

export function playCountdownBeep(secondsLeft: number): void {
  const ctx = getAudioContext();
  const volume = countdownBeepVolume(secondsLeft);
  const frequency = noteToFrequency(Note.E5);
  if (frequency !== null) {
    playPianoNote(ctx, frequency, 0.14, volume);
  }
}

function resolveAlarmMelody(melodyId?: ClockTimerAlarmMelodyId): MelodyStep[] {
  const id = melodyId ?? getClockTimerAlarmMelodyId();
  return CLOCK_TIMER_ALARM_MELODIES[id];
}

export function playTimerAlarm(
  maxDurationMs: number,
  onEnd?: () => void,
  melodyId?: ClockTimerAlarmMelodyId,
): () => void {
  stopTimerAlarm();

  const ctx = getAudioContext();
  const melody = resolveAlarmMelody(melodyId);
  const startedAt = performance.now();
  let noteIndex = 0;
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = (): void => {
    if (stopped) return;
    const elapsed = performance.now() - startedAt;
    if (elapsed >= maxDurationMs) {
      alarmStopFn = null;
      onEnd?.();
      return;
    }

    const intensity = Math.min(1, elapsed / maxDurationMs);
    const volume = ALARM_MIN_VOLUME + intensity * (ALARM_MAX_VOLUME - ALARM_MIN_VOLUME);
    const step = melody[noteIndex % melody.length]!;
    const durationSec = melodyStepDurationSec(step);

    if (!isRestNote(step.note)) {
      const frequency = noteToFrequency(step.note);
      if (frequency !== null) {
        playPianoNote(ctx, frequency, durationSec, volume);
      }
    }

    noteIndex += 1;
    timeoutId = setTimeout(scheduleNext, durationSec * 1000);
  };

  scheduleNext();

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    alarmStopFn = null;
  };

  alarmStopFn = stop;
  return stop;
}

export function stopTimerAlarm(): void {
  alarmStopFn?.();
  alarmStopFn = null;
}

export { Note } from './clockTimerNotes';
export {
  CLASSIC_ALARM_MELODY,
  GENTLE_ALARM_MELODY,
  CLOCK_TIMER_ALARM_MELODY_IDS,
  type ClockTimerAlarmMelodyId,
} from './clockTimerMelodies';
