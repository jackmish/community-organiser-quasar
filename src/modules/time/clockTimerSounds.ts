let audioCtx: AudioContext | null = null;
let alarmStopFn: (() => void) | null = null;

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

function playTone(
  ctx: AudioContext,
  frequency: number,
  durationSec: number,
  volume: number,
  type: OscillatorType = 'sine',
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);

  const start = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

  osc.start(start);
  osc.stop(start + durationSec + 0.05);
}

export function playCountdownBeep(): void {
  const ctx = getAudioContext();
  playTone(ctx, 880, 0.1, 0.22);
}

const ALARM_MELODY: ReadonlyArray<{ freq: number; dur: number }> = [
  { freq: 523.25, dur: 0.28 },
  { freq: 659.25, dur: 0.28 },
  { freq: 783.99, dur: 0.28 },
  { freq: 1046.5, dur: 0.42 },
  { freq: 783.99, dur: 0.28 },
  { freq: 659.25, dur: 0.28 },
  { freq: 523.25, dur: 0.42 },
];

export function playTimerAlarm(maxDurationMs: number, onEnd?: () => void): () => void {
  stopTimerAlarm();

  const ctx = getAudioContext();
  const startedAt = performance.now();
  let noteIndex = 0;
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = (): void => {
    if (stopped) return;
    if (performance.now() - startedAt >= maxDurationMs) {
      alarmStopFn = null;
      onEnd?.();
      return;
    }

    const note = ALARM_MELODY[noteIndex % ALARM_MELODY.length]!;
    playTone(ctx, note.freq, note.dur, 0.55, 'triangle');
    noteIndex += 1;
    timeoutId = setTimeout(scheduleNext, note.dur * 1000);
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
