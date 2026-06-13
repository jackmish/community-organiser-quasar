import { ref, computed, watch, onMounted, onBeforeUnmount, type Ref } from 'vue';
import {
  alignedClockSlotKey,
  msUntilNextClockTick,
  nextAlignedClockTime,
  resolveClockIntervalMinutes,
} from '../infoscreenClockSchedule';
import {
  clockDisplayDurationMs,
  INFOSCREEN_INTERACTION_IDLE_MS,
  type InfoscreenSettings,
} from '../infoscreenSettings';
import {
  INFOSCREEN_DISMISS_SPLASH_EVENT,
  INFOSCREEN_TEST_CLOCK_EVENT,
} from '../infoscreenUi';

export type InfoscreenWallPhase = 'idle' | 'interacting' | 'clock-splash';

/** Trigger within this window before the next aligned minute (covers 1s polling jitter). */
const ALIGNED_BOUNDARY_TRIGGER_MS = 1500;

export function useInfoscreenWallClock(args: {
  active: Ref<boolean>;
  settings: Ref<InfoscreenSettings>;
}): {
  phase: Ref<InfoscreenWallPhase>;
  progress: Ref<number>;
  showClockSplash: Ref<boolean>;
  locked: Ref<boolean>;
} {
  const phase = ref<InfoscreenWallPhase>('idle');
  const progress = ref(0);
  const showClockSplash = ref(false);
  const splashEndsAt = ref(0);
  const interactionEndsAt = ref(0);
  let lastSplashSlotKey = '';

  const intervalMinutes = computed(() =>
    resolveClockIntervalMinutes(
      args.settings.value.clockIntervalPreset,
      args.settings.value.clockIntervalCustomMinutes,
    ),
  );

  const locked = computed(
    () =>
      args.active.value &&
      phase.value === 'idle' &&
      args.settings.value.lockScreen &&
      !showClockSplash.value,
  );

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let splashTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearSplashTimer(): void {
    if (splashTimer) {
      clearTimeout(splashTimer);
      splashTimer = null;
    }
  }

  function clearIdleTimer(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function clearTickTimer(): void {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function updateProgress(): void {
    const now = Date.now();
    const intervalMs = intervalMinutes.value * 60 * 1000;
    const remaining = msUntilNextClockTick(new Date(now), intervalMinutes.value);
    progress.value = intervalMs > 0 ? 1 - remaining / intervalMs : 0;
  }

  function endClockSplash(): void {
    clearSplashTimer();
    showClockSplash.value = false;
    splashEndsAt.value = 0;
    if (Date.now() < interactionEndsAt.value) {
      phase.value = 'interacting';
    } else {
      phase.value = 'idle';
    }
  }

  function splashDurationMs(): number {
    return clockDisplayDurationMs(args.settings.value.clockDisplaySeconds);
  }

  function startClockSplash(opts?: { force?: boolean }): void {
    if (!opts?.force && !args.active.value) return;
    showClockSplash.value = true;
    phase.value = 'clock-splash';
    const duration = splashDurationMs();
    splashEndsAt.value = Date.now() + duration;
    clearSplashTimer();
    splashTimer = setTimeout(() => endClockSplash(), duration);
  }

  function onTestClockEvent(): void {
    startClockSplash({ force: true });
  }

  function scheduleIdleEnd(): void {
    clearIdleTimer();
    interactionEndsAt.value = Date.now() + INFOSCREEN_INTERACTION_IDLE_MS;
    phase.value = 'interacting';
    idleTimer = setTimeout(() => {
      interactionEndsAt.value = 0;
      if (!showClockSplash.value) {
        phase.value = 'idle';
      }
    }, INFOSCREEN_INTERACTION_IDLE_MS);
  }

  function dismissSplashFromTap(): void {
    if (!showClockSplash.value) return;
    endClockSplash();
  }

  function onUserActivity(): void {
    if (showClockSplash.value) {
      dismissSplashFromTap();
      if (!args.active.value) return;
      scheduleIdleEnd();
      return;
    }
    if (!args.active.value) return;
    scheduleIdleEnd();
  }

  function onPointerDown(): void {
    onUserActivity();
  }

  function onDismissSplashEvent(): void {
    dismissSplashFromTap();
    if (args.active.value) {
      scheduleIdleEnd();
    }
  }

  function shouldTriggerAlignedSplash(now: Date): boolean {
    const remaining = msUntilNextClockTick(now, intervalMinutes.value);
    if (remaining > ALIGNED_BOUNDARY_TRIGGER_MS) return false;
    const slotKey = alignedClockSlotKey(
      nextAlignedClockTime(now, intervalMinutes.value),
      intervalMinutes.value,
    );
    if (slotKey === lastSplashSlotKey) return false;
    lastSplashSlotKey = slotKey;
    return true;
  }

  function checkClockTick(): void {
    if (!args.active.value) return;
    if (phase.value === 'interacting') {
      updateProgress();
      return;
    }
    if (showClockSplash.value) {
      updateProgress();
      return;
    }

    const now = new Date();
    if (shouldTriggerAlignedSplash(now)) {
      startClockSplash();
    }
    updateProgress();
  }

  function startWallClock(): void {
    clearTickTimer();
    phase.value = 'idle';
    interactionEndsAt.value = 0;
    showClockSplash.value = false;
    lastSplashSlotKey = '';
    updateProgress();
    tickTimer = setInterval(checkClockTick, 1000);
    checkClockTick();
  }

  function stopWallClock(): void {
    clearTickTimer();
    clearSplashTimer();
    clearIdleTimer();
    showClockSplash.value = false;
    phase.value = 'idle';
    progress.value = 0;
    lastSplashSlotKey = '';
  }

  watch(
    () => args.active.value,
    (active) => {
      if (active) {
        startWallClock();
      } else {
        stopWallClock();
      }
    },
    { immediate: true },
  );

  watch(intervalMinutes, () => {
    if (args.active.value) {
      lastSplashSlotKey = '';
      updateProgress();
    }
  });

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener(INFOSCREEN_TEST_CLOCK_EVENT, onTestClockEvent);
    window.addEventListener(INFOSCREEN_DISMISS_SPLASH_EVENT, onDismissSplashEvent);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener(INFOSCREEN_TEST_CLOCK_EVENT, onTestClockEvent);
    window.removeEventListener(INFOSCREEN_DISMISS_SPLASH_EVENT, onDismissSplashEvent);
    stopWallClock();
  });

  return { phase, progress, showClockSplash, locked };
}
