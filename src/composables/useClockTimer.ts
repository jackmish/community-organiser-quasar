import { computed, onBeforeUnmount, ref } from 'vue';
import {
  playCountdownBeep,
  playTimerAlarm,
  resumeClockTimerAudio,
  stopTimerAlarm,
  CLOCK_TIMER_COUNTDOWN_SECONDS,
} from 'src/modules/time/clockTimerSounds';

export type ClockTimerPhase = 'setup' | 'running' | 'paused' | 'alarm';

export const CLOCK_TIMER_MIN_MINUTES = 0;
export const CLOCK_TIMER_MAX_MINUTES = 15;
export const CLOCK_TIMER_DEFAULT_MINUTES = 0;
const COUNTDOWN_BEEP_SECONDS = CLOCK_TIMER_COUNTDOWN_SECONDS;
const ALARM_MAX_MS = 10_000;
const TICK_MS = 250;

export function getMinuteSlotCenterPercent(
  minute: number,
  max: number = CLOCK_TIMER_MAX_MINUTES,
): number {
  const slotIndex = max - minute;
  return ((slotIndex + 0.5) / (max + 1)) * 100;
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function useClockTimer() {
  const phase = ref<ClockTimerPhase>('setup');
  const durationMinutes = ref(CLOCK_TIMER_DEFAULT_MINUTES);
  const remainingMs = ref(0);
  const totalMs = ref(0);

  let endsAt = 0;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let lastBeepSecond = -1;
  let alarmDismiss: (() => void) | null = null;

  const progressPercent = computed(() => {
    if (phase.value === 'alarm') return 100;
    if (!totalMs.value) return 0;
    return Math.max(0, Math.min(100, (remainingMs.value / totalMs.value) * 100));
  });

  const timerSegmentCount = computed(() => {
    if (!totalMs.value) return 0;
    return Math.max(1, Math.round(totalMs.value / 60_000));
  });

  function segmentFillPercent(segmentIndex: number): number {
    const segmentCount = timerSegmentCount.value;
    if (!segmentCount || !totalMs.value) return 0;
    if (phase.value === 'alarm') return 100;

    const remainingRatio = Math.max(0, Math.min(1, remainingMs.value / totalMs.value));
    const fillStart = 1 - remainingRatio;
    const segmentStart = segmentIndex / segmentCount;
    const segmentEnd = (segmentIndex + 1) / segmentCount;
    const overlapStart = Math.max(segmentStart, fillStart);
    const overlapEnd = Math.min(segmentEnd, 1);
    const overlap = Math.max(0, overlapEnd - overlapStart);
    return (overlap / (1 / segmentCount)) * 100;
  }

  const remainingLabel = computed(() => formatRemaining(remainingMs.value));

  const durationLabel = computed(() => String(durationMinutes.value));

  const thumbCenterLeft = computed(
    () => `${getMinuteSlotCenterPercent(durationMinutes.value)}%`,
  );

  function stopTick(): void {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function resetToSetup(): void {
    stopTick();
    stopTimerAlarm();
    alarmDismiss = null;
    phase.value = 'setup';
    durationMinutes.value = CLOCK_TIMER_DEFAULT_MINUTES;
    remainingMs.value = 0;
    totalMs.value = 0;
    lastBeepSecond = -1;
  }

  function onTimerFinished(): void {
    stopTick();
    remainingMs.value = 0;
    phase.value = 'alarm';
    lastBeepSecond = -1;
    alarmDismiss = playTimerAlarm(ALARM_MAX_MS, () => {
      resetToSetup();
    });
  }

  function tick(): void {
    if (phase.value !== 'running') return;

    remainingMs.value = Math.max(0, endsAt - Date.now());
    const secondsLeft = Math.ceil(remainingMs.value / 1000);

    if (secondsLeft > 0 && secondsLeft <= COUNTDOWN_BEEP_SECONDS && secondsLeft !== lastBeepSecond) {
      lastBeepSecond = secondsLeft;
      playCountdownBeep(secondsLeft);
    }

    if (remainingMs.value <= 0) {
      onTimerFinished();
    }
  }

  function startTick(): void {
    stopTick();
    tickTimer = setInterval(tick, TICK_MS);
    tick();
  }

  function startTimer(minutes: number): void {
    if (minutes <= 0 || phase.value !== 'setup') return;
    resumeClockTimerAudio();
    durationMinutes.value = minutes;
    totalMs.value = minutes * 60 * 1000;
    remainingMs.value = totalMs.value;
    endsAt = Date.now() + totalMs.value;
    phase.value = 'running';
    lastBeepSecond = -1;
    startTick();
  }

  function setDurationMinutes(minutes: number): void {
    durationMinutes.value = minutes;
  }

  function startAlarmTest(): void {
    if (phase.value !== 'setup') return;
    resumeClockTimerAudio();
    durationMinutes.value = 0;
    totalMs.value = COUNTDOWN_BEEP_SECONDS * 1000;
    remainingMs.value = totalMs.value;
    endsAt = Date.now() + totalMs.value;
    phase.value = 'running';
    lastBeepSecond = -1;
    startTick();
  }

  function tryStartFromDuration(): void {
    if (durationMinutes.value > 0) {
      startTimer(durationMinutes.value);
    }
  }

  function pause(): void {
    if (phase.value !== 'running') return;
    remainingMs.value = Math.max(0, endsAt - Date.now());
    phase.value = 'paused';
    stopTick();
  }

  function resume(): void {
    if (phase.value !== 'paused') return;
    resumeClockTimerAudio();
    endsAt = Date.now() + remainingMs.value;
    phase.value = 'running';
    lastBeepSecond = -1;
    startTick();
  }

  function cancel(): void {
    resetToSetup();
  }

  function dismissAlarm(): void {
    alarmDismiss?.();
    resetToSetup();
  }

  onBeforeUnmount(() => {
    resetToSetup();
  });

  return {
    phase,
    durationMinutes,
    remainingMs,
    totalMs,
    progressPercent,
    timerSegmentCount,
    segmentFillPercent,
    remainingLabel,
    durationLabel,
    thumbCenterLeft,
    setDurationMinutes,
    tryStartFromDuration,
    startAlarmTest,
    pause,
    resume,
    cancel,
    dismissAlarm,
    CLOCK_TIMER_MIN_MINUTES,
    CLOCK_TIMER_MAX_MINUTES,
  };
}
