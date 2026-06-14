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
        <div class="clock-timer__slider-wrap">
          <div class="clock-timer__rail" aria-hidden="true">
            <span
              v-for="minute in divisionMinutes"
              :key="minute"
              class="clock-timer__division"
              :class="{ 'clock-timer__division--minor': minute % 5 !== 0 }"
              :style="{ left: divisionPosition(minute) }"
            />
            <span class="clock-timer__fill" :style="{ width: fillWidth }" />
            <span class="clock-timer__max-mark">
              {{ $text('clock.timer.max_minutes').replace('{value}', String(CLOCK_TIMER_MAX_MINUTES)) }}
            </span>
          </div>

          <span
            class="clock-timer__thumb"
            :style="{ left: thumbLeft }"
          >
            <span class="clock-timer__thumb-value">{{ durationLabel }}</span>
          </span>

          <input
            :value="durationMinutes"
            class="clock-timer__slider clock-timer__slider--reversed"
            type="range"
            :min="CLOCK_TIMER_MIN_MINUTES"
            :max="CLOCK_TIMER_MAX_MINUTES"
            step="1"
            :aria-label="$text('clock.timer.set_minutes')"
            @input="onSliderInput"
            @change="onSliderChange"
          />
        </div>
      </template>

      <template v-else>
        <div class="clock-timer__progress-wrap">
          <div class="clock-timer__progress" role="progressbar" :aria-valuenow="progressPercent">
            <div class="clock-timer__progress-fill" :style="{ width: `${progressPercent}%` }" />
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
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import { useClockTimer } from 'src/composables/useClockTimer';

const {
  phase,
  durationMinutes,
  progressPercent,
  remainingLabel,
  durationLabel,
  thumbLeft,
  fillWidth,
  setDurationMinutes,
  tryStartFromDuration,
  pause,
  resume,
  cancel,
  dismissAlarm,
  CLOCK_TIMER_MIN_MINUTES,
  CLOCK_TIMER_MAX_MINUTES,
} = useClockTimer();

const divisionMinutes = computed(() =>
  Array.from({ length: CLOCK_TIMER_MAX_MINUTES + 1 }, (_, index) => index),
);

function divisionPosition(minute: number): string {
  if (CLOCK_TIMER_MAX_MINUTES <= 0) return '100%';
  const ratio = minute / CLOCK_TIMER_MAX_MINUTES;
  return `${(1 - ratio) * 100}%`;
}

function onSliderInput(event: Event): void {
  const minutes = Number((event.target as HTMLInputElement).value);
  setDurationMinutes(minutes);
}

function onSliderChange(): void {
  tryStartFromDuration();
}
</script>

<style scoped>
.clock-timer {
  --clock-timer-size: 40px;
  --clock-timer-thumb-size: var(--clock-timer-size);
  --clock-timer-thumb-radius: 8px;

  display: flex;
  align-items: stretch;
  width: 100%;
  min-height: var(--clock-timer-size);
  overflow: visible;
}

.clock-timer--alarm .clock-timer__progress-fill {
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

.clock-timer__slider-wrap,
.clock-timer__progress-wrap {
  position: relative;
  width: 100%;
  height: var(--clock-timer-size);
  overflow: visible;
}

.clock-timer__rail {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 22%, transparent);
  overflow: hidden;
  pointer-events: none;
}

.clock-timer__division {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-0.5px);
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 34%, transparent);
}

.clock-timer__division--minor {
  top: 25%;
  bottom: 25%;
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 24%, transparent);
}

.clock-timer__fill {
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
  height: 100%;
  background: color-mix(in srgb, var(--clock-timer-thumb-bg, #0277bd) 55%, transparent);
  transition: width 0.08s linear;
}

.clock-timer__thumb {
  position: absolute;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--clock-timer-thumb-size);
  height: var(--clock-timer-thumb-size);
  border-radius: var(--clock-timer-thumb-radius);
  background: var(--clock-timer-thumb-bg, #0277bd);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.72),
    0 2px 5px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.65));
  transition: left 0.08s linear;
  pointer-events: none;
}

.clock-timer__thumb-value {
  font-size: 0.82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--clock-panel-fg, #ffffff);
}

.clock-timer__slider {
  position: relative;
  z-index: 3;
  width: 100%;
  height: var(--clock-timer-size);
  margin: 0;
  padding: 0;
  appearance: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: ew-resize;
}

.clock-timer__slider::-webkit-slider-runnable-track {
  height: var(--clock-timer-size);
  border-radius: 0;
  background: transparent;
}

.clock-timer__slider--reversed {
  direction: rtl;
}

.clock-timer__slider::-webkit-slider-thumb {
  appearance: none;
  width: var(--clock-timer-thumb-size);
  height: var(--clock-timer-thumb-size);
  margin-top: 0;
  border-radius: var(--clock-timer-thumb-radius);
  border: 0;
  background: transparent;
  box-shadow: none;
  cursor: ew-resize;
}

.clock-timer__slider::-moz-range-track {
  height: var(--clock-timer-size);
  border-radius: 0;
  background: transparent;
}

.clock-timer__slider::-moz-range-thumb {
  width: var(--clock-timer-thumb-size);
  height: var(--clock-timer-thumb-size);
  border-radius: var(--clock-timer-thumb-radius);
  border: 0;
  background: transparent;
  box-shadow: none;
  cursor: ew-resize;
}

.clock-timer__max-mark {
  position: absolute;
  left: 8px;
  top: 50%;
  z-index: 1;
  transform: translateY(-50%);
  padding: 2px 7px;
  border-radius: 2px;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  color: var(--clock-timer-thumb-bg, #0277bd);
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 88%, transparent);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--clock-timer-thumb-bg, #0277bd) 35%, transparent);
}

.clock-timer__progress {
  position: relative;
  width: 100%;
  height: var(--clock-timer-size);
  border-radius: 0;
  background: color-mix(in srgb, var(--clock-panel-fg, #ffffff) 22%, transparent);
  overflow: hidden;
}

.clock-timer__progress-fill {
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
  height: 100%;
  border-radius: 0;
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
