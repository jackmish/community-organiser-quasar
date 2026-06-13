import { ref, watch, onBeforeUnmount, type Ref } from 'vue';
import {
  LAYOUT_DRIFT_MAX_SHIFT_PX,
  LAYOUT_DRIFT_STEP_INTERVAL_SECONDS,
} from '../infoscreenVariants';

export type InfoscreenDriftStep = { x: number; y: number };

export function buildDriftCycle(maxShiftPx: number): InfoscreenDriftStep[] {
  const raw: Array<[number, number]> = [
    [0, 0],
    [1, -1],
    [2, 0],
    [2, 1],
    [1, 2],
    [0, 2],
    [-1, 2],
    [-2, 1],
    [-2, 0],
    [-2, -1],
    [-1, -2],
    [0, -1],
    [1, 0],
    [0, 0],
  ];
  return raw.map(([x, y]) => ({
    x: Math.max(-maxShiftPx, Math.min(maxShiftPx, x)),
    y: Math.max(-maxShiftPx, Math.min(maxShiftPx, y)),
  }));
}

function applyDriftStep(root: HTMLElement, step: InfoscreenDriftStep): void {
  root.style.setProperty('--co21-infoscreen-drift-x', `${step.x}px`);
  root.style.setProperty('--co21-infoscreen-drift-y', `${step.y}px`);
}

function applyDriftDuration(root: HTMLElement, stepIntervalSeconds: number): void {
  const seconds = Math.max(30, stepIntervalSeconds);
  root.style.setProperty('--co21-infoscreen-drift-duration', `${seconds}s`);
}

export function useInfoscreenDrift(args: { active: Ref<boolean> }): void {
  const stepIndex = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function clearTimer(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function resetDrift(): void {
    const root = document.documentElement;
    applyDriftStep(root, { x: 0, y: 0 });
    applyDriftDuration(root, LAYOUT_DRIFT_STEP_INTERVAL_SECONDS);
    stepIndex.value = 0;
  }

  function advanceDrift(): void {
    const cycle = buildDriftCycle(LAYOUT_DRIFT_MAX_SHIFT_PX);
    if (cycle.length === 0) return;
    stepIndex.value = (stepIndex.value + 1) % cycle.length;
    applyDriftStep(document.documentElement, cycle[stepIndex.value]!);
  }

  function restartTimer(): void {
    clearTimer();
    const root = document.documentElement;
    applyDriftDuration(root, LAYOUT_DRIFT_STEP_INTERVAL_SECONDS);

    if (!args.active.value) {
      resetDrift();
      return;
    }

    const cycle = buildDriftCycle(LAYOUT_DRIFT_MAX_SHIFT_PX);
    applyDriftStep(root, cycle[0] ?? { x: 0, y: 0 });
    stepIndex.value = 0;

    const intervalMs = LAYOUT_DRIFT_STEP_INTERVAL_SECONDS * 1000;
    timer = setInterval(advanceDrift, intervalMs);
  }

  watch(() => args.active.value, () => restartTimer(), { immediate: true });

  onBeforeUnmount(() => {
    clearTimer();
    resetDrift();
  });
}

export function setInfoscreenModeClasses(args: {
  presentationEnabled: boolean;
  screensaverEnabled: boolean;
  locked: boolean;
}): void {
  const root = document.documentElement;
  const anyEnabled = args.presentationEnabled || args.screensaverEnabled;
  root.classList.toggle('co21-infoscreen-mode', anyEnabled);
  root.classList.toggle('co21-infoscreen-mode--layout-drift', args.presentationEnabled);
  root.classList.toggle('co21-infoscreen-mode--wall-clock', args.screensaverEnabled);
  root.classList.toggle('co21-infoscreen-mode--locked', args.screensaverEnabled && args.locked);
}
