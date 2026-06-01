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

const SCROLL_NUDGE_SELECTORS = [
  '.day-organiser-day-section',
  '.day-organiser-calendar-section',
  '.tasks-list-wrapper',
  '.task-list-card',
];

function nudgeScrollContainers(direction: Ref<1 | -1>): void {
  for (const selector of SCROLL_NUDGE_SELECTORS) {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement)) continue;
    if (el.scrollHeight <= el.clientHeight + 4) continue;

    const maxScroll = el.scrollHeight - el.clientHeight;
    let next = el.scrollTop + direction.value;
    if (next >= maxScroll) {
      next = maxScroll;
      direction.value = -1;
    } else if (next <= 0) {
      next = 0;
      direction.value = 1;
    }
    el.scrollTop = next;
  }
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
  const scrollDirection = ref<1 | -1>(1);
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
    scrollDirection.value = 1;
  }

  function advanceDrift(): void {
    const cycle = buildDriftCycle(LAYOUT_DRIFT_MAX_SHIFT_PX);
    if (cycle.length === 0) return;
    stepIndex.value = (stepIndex.value + 1) % cycle.length;
    applyDriftStep(document.documentElement, cycle[stepIndex.value]!);
    nudgeScrollContainers(scrollDirection);
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
  enabled: boolean;
  variant: string;
  locked: boolean;
}): void {
  const root = document.documentElement;
  root.classList.toggle('co21-infoscreen-mode', args.enabled);
  root.classList.toggle('co21-infoscreen-mode--layout-drift', args.enabled && args.variant === 'layout-drift');
  root.classList.toggle('co21-infoscreen-mode--wall-clock', args.enabled && args.variant === 'wall-clock');
  root.classList.toggle('co21-infoscreen-mode--locked', args.enabled && args.locked);
}
