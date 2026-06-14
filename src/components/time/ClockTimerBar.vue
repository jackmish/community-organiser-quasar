<template>
  <div class="clock-timer" :class="{ 'clock-timer--alarm': phase === 'alarm' }">
    <div v-if="phase === 'setup'" class="clock-timer__actions clock-timer__actions--start">
      <q-btn
        square
        unelevated
        class="clock-timer__btn clock-timer__btn--mode"
        icon="tune"
        disable
        :aria-label="$text('clock.timer.mode')"
      >
        <q-tooltip>{{ $text('clock.timer.mode_soon') }}</q-tooltip>
      </q-btn>
    </div>

    <div class="clock-timer__track">
      <template v-if="phase === 'setup'">
        <div
          ref="trackRef"
          class="clock-timer__slider-wrap"
          role="slider"
          :aria-valuemin="CLOCK_TIMER_MIN_MINUTES"
          :aria-valuemax="CLOCK_TIMER_MAX_MINUTES"
          :aria-valuenow="durationMinutes"
          :aria-label="$text('clock.timer.set_minutes')"
          tabindex="0"
          @keydown="onTrackKeydown"
          @pointerdown="onTrackPointerDown"
          @pointermove="onTrackPointerMove"
          @pointerup="onTrackPointerUp"
          @pointercancel="onTrackPointerUp"
        >
          <div class="clock-timer__rail" aria-hidden="true">
            <div
              class="clock-timer__slots"
              :style="{ gridTemplateColumns: `repeat(${CLOCK_TIMER_MAX_MINUTES + 1}, 1fr)` }"
            >
              <div
                v-for="minute in slotMinutes"
                :key="minute"
                class="clock-timer__slot"
                :class="{
                  'clock-timer__slot--in-range':
                    durationMinutes > 0 && minute <= durationMinutes,
                }"
                :style="slotStyle(minute)"
              />
            </div>
            <span
              v-for="mark in scaleMarks"
              :key="`mark-${mark}`"
              class="clock-timer__scale-mark"
              :style="{ left: minuteCenterLeft(mark) }"
            >
              {{ mark }}
            </span>
          </div>

          <span
            class="clock-timer__thumb"
            :style="{ left: thumbCenterLeft }"
            :aria-label="$text('clock.timer.minutes_short').replace('{value}', durationLabel)"
          >
            <q-icon name="touch_app" class="clock-timer__thumb-icon" />
          </span>

          <span
            v-if="isDragging"
            class="clock-timer__value-tip"
            :style="{ left: thumbCenterLeft }"
          >
            {{ $text('clock.timer.minutes_short').replace('{value}', durationLabel) }}
          </span>
        </div>
      </template>

      <template v-else>
        <div class="clock-timer__progress-wrap">
          <div
            class="clock-timer__progress"
            :class="{ 'clock-timer__progress--alarm': phase === 'alarm' }"
            role="progressbar"
            :aria-valuenow="progressPercent"
          >
            <div class="clock-timer__progress-segments">
              <div
                v-for="segmentIndex in timerSegmentCount"
                :key="segmentIndex"
                class="clock-timer__progress-segment"
              >
                <div
                  class="clock-timer__progress-segment-fill"
                  :style="{ width: `${segmentFillPercent(segmentIndex - 1)}%` }"
                />
              </div>
            </div>
          </div>
          <span class="clock-timer__remaining" aria-live="polite">
            {{ phase === 'alarm' ? '0:00' : remainingLabel }}
          </span>
        </div>
      </template>
    </div>

    <div v-if="phase !== 'setup'" class="clock-timer__actions clock-timer__actions--end">
      <template v-if="phase === 'alarm'">
        <q-btn
          square
          unelevated
          class="clock-timer__btn clock-timer__btn--alarm"
          icon="notifications_off"
          :aria-label="$text('clock.timer.stop')"
          @click="dismissAlarm"
        />
      </template>

      <template v-else>
        <q-btn
          square
          unelevated
          class="clock-timer__btn"
          :icon="phase === 'paused' ? 'play_arrow' : 'pause'"
          :aria-label="phase === 'paused' ? $text('clock.timer.resume') : $text('clock.timer.pause')"
          @click="phase === 'paused' ? resume() : pause()"
        />
        <q-btn
          square
          unelevated
          class="clock-timer__btn"
          icon="close"
          :aria-label="$text('clock.timer.cancel')"
          @click="cancel"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { $text } from 'src/modules/lang';
import {
  getMinuteSlotCenterPercent,
  useClockTimer,
} from 'src/composables/useClockTimer';

const isDragging = ref(false);
const trackRef = ref<HTMLElement | null>(null);
let trackPointerActive = false;

const SCALE_MARK_MINUTES = [5, 10, 15] as const;

/** One solid mix level per slot — sharp steps, 16-level posterized strip. */
const SLOT_IDLE_STEPS = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68] as const;
const SLOT_FILL_STEPS = [26, 32, 38, 44, 50, 56, 62, 68, 74, 80, 86, 90, 94, 96, 98, 100] as const;

const {
  phase,
  durationMinutes,
  progressPercent,
  timerSegmentCount,
  segmentFillPercent,
  remainingLabel,
  durationLabel,
  thumbCenterLeft,
  setDurationMinutes,
  tryStartFromDuration,
  pause,
  resume,
  cancel,
  dismissAlarm,
  CLOCK_TIMER_MIN_MINUTES,
  CLOCK_TIMER_MAX_MINUTES,
} = useClockTimer();

const slotMinutes = computed(() =>
  Array.from({ length: CLOCK_TIMER_MAX_MINUTES + 1 }, (_, index) => CLOCK_TIMER_MAX_MINUTES - index),
);

const scaleMarks = SCALE_MARK_MINUTES;

function minuteCenterLeft(minute: number): string {
  return `${getMinuteSlotCenterPercent(minute, CLOCK_TIMER_MAX_MINUTES)}%`;
}

function slotStyle(minute: number): Record<string, string> {
  const slotIndex = CLOCK_TIMER_MAX_MINUTES - minute;
  const idleMix = SLOT_IDLE_STEPS[slotIndex] ?? SLOT_IDLE_STEPS[0];
  const fillMix = SLOT_FILL_STEPS[slotIndex] ?? SLOT_FILL_STEPS[0];
  return {
    '--slot-idle-color': `color-mix(in srgb, var(--clock-panel-fg, #ffffff) ${idleMix}%, transparent)`,
    '--slot-fill-color': `color-mix(in srgb, var(--clock-timer-thumb-bg, #0277bd) ${fillMix}%, transparent)`,
  };
}

function pickMinuteFromPointer(event: PointerEvent): number {
  const el = trackRef.value;
  if (!el) return CLOCK_TIMER_MIN_MINUTES;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return CLOCK_TIMER_MIN_MINUTES;
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const slotIndex = Math.round(ratio * (CLOCK_TIMER_MAX_MINUTES + 1) - 0.5);
  const bounded = Math.max(0, Math.min(CLOCK_TIMER_MAX_MINUTES, slotIndex));
  return CLOCK_TIMER_MAX_MINUTES - bounded;
}

function onTrackPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  trackPointerActive = true;
  isDragging.value = true;
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  setDurationMinutes(pickMinuteFromPointer(event));
}

function onTrackPointerMove(event: PointerEvent): void {
  if (!trackPointerActive) return;
  setDurationMinutes(pickMinuteFromPointer(event));
}

function onTrackPointerUp(): void {
  if (!trackPointerActive) return;
  trackPointerActive = false;
  isDragging.value = false;
  tryStartFromDuration();
}

function onTrackKeydown(event: KeyboardEvent): void {
  let next = durationMinutes.value;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next += 1;
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next -= 1;
  } else if (event.key === 'Home') {
    next = CLOCK_TIMER_MAX_MINUTES;
  } else if (event.key === 'End') {
    next = CLOCK_TIMER_MIN_MINUTES;
  } else {
    return;
  }
  event.preventDefault();
  const clamped = Math.max(CLOCK_TIMER_MIN_MINUTES, Math.min(CLOCK_TIMER_MAX_MINUTES, next));
  setDurationMinutes(clamped);
  tryStartFromDuration();
}
</script>

<style scoped>
.clock-timer {
  --clock-timer-size: 40px;
  --clock-timer-thumb-size: 54px;

  display: flex;
  align-items: stretch;
  width: 100%;
  min-height: var(--clock-timer-size);
  overflow: visible;
}

.clock-timer--alarm .clock-timer__progress-segment-fill {
  animation: clock-timer-alarm-pulse 0.8s ease-in-out infinite alternate;
}

.clock-timer__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
}

.clock-timer__actions--start {
  border-right: 1px solid rgba(255, 255, 255, 0.12);
}

.clock-timer__actions--end {
  border-left: 1px solid rgba(255, 255, 255, 0.12);
}

.clock-timer__track {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: stretch;
  overflow: visible;
}

.clock-timer__slider-wrap {
  position: relative;
  width: 100%;
  height: var(--clock-timer-size);
  overflow: visible;
  cursor: pointer;
  touch-action: none;
}

.clock-timer__progress-wrap {
  position: relative;
  width: 100%;
  height: var(--clock-timer-size);
  overflow: visible;
}

.clock-timer__rail {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.clock-timer__slots {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 2px;
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 8%, transparent);
}

.clock-timer__slot {
  height: 100%;
  background: var(--slot-idle-color);
}

.clock-timer__slot--in-range {
  background: var(--slot-fill-color);
}

.clock-timer__thumb {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--clock-timer-thumb-size);
  height: var(--clock-timer-thumb-size);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 68%, transparent);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
  transition: left 0.08s linear;
  pointer-events: none;
}

.clock-timer__thumb-icon {
  font-size: 1.45rem;
  color: var(--clock-timer-thumb-bg, #0277bd);
}

.clock-timer__value-tip {
  position: absolute;
  z-index: 4;
  bottom: calc(100% + 4px);
  transform: translateX(-50%);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  pointer-events: none;
  color: var(--clock-timer-thumb-bg, #0277bd);
  background: var(--clock-panel-fg, #ffffff);
}

.clock-timer__scale-mark {
  position: absolute;
  top: 50%;
  z-index: 1;
  transform: translate(-50%, -50%);
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 0.95rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--clock-timer-thumb-bg, #0277bd);
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 22%, transparent);
  pointer-events: none;
}

.clock-timer__progress {
  position: relative;
  width: 100%;
  height: var(--clock-timer-size);
  border-radius: 0;
  overflow: hidden;
}

.clock-timer__progress-segments {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 2px;
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 22%, transparent);
}

.clock-timer__progress-segment {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.clock-timer__progress-segment-fill {
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
  height: 100%;
  background: var(--clock-timer-thumb-bg, #0277bd);
  transition: width 0.25s linear;
}

.clock-timer__remaining {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

.clock-timer__btn {
  width: var(--clock-timer-size);
  min-width: var(--clock-timer-size);
  height: var(--clock-timer-size);
  padding: 0;
  border-radius: 0;
  color: var(--clock-panel-fg, #ffffff);
  background: rgba(255, 255, 255, 0.16);
}

.clock-timer__btn + .clock-timer__btn {
  border-left: 1px solid rgba(255, 255, 255, 0.12);
}

.clock-timer__btn:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.26);
}

.clock-timer__btn--mode {
  opacity: 0.55;
}

.clock-timer__btn--alarm {
  background: rgba(255, 255, 255, 0.3);
}

@keyframes clock-timer-alarm-pulse {
  from {
    opacity: 0.65;
  }
  to {
    opacity: 1;
  }
}
</style>
