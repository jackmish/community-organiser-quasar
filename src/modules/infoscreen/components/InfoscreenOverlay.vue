<template>
  <Teleport to="body">
    <div
      v-if="shellVisible"
      class="co21-infoscreen-overlay"
      :class="{ 'co21-infoscreen-overlay--splash': showClockSplash }"
    >
      <!-- Backdrop + content: separate fades so time/date motion is visible -->
      <Transition
        name="infoscreen-backdrop"
        appear
        @before-leave="onSplashLeaveStart"
        @after-leave="onSplashLeaveEnd"
      >
        <div
          v-if="showClockSplash"
          key="infoscreen-splash-backdrop"
          class="co21-infoscreen-splash-backdrop"
          aria-hidden="true"
          @pointerdown.stop="onSplashTap"
        />
      </Transition>

      <Transition
        name="infoscreen-content"
        appear
        @before-leave="onSplashLeaveStart"
        @after-leave="onSplashLeaveEnd"
      >
        <div
          v-if="showClockSplash"
          key="infoscreen-splash-content"
          class="co21-infoscreen-splash-content"
          role="status"
          :aria-label="splashAriaLabel"
          @pointerdown.stop="onSplashTap"
        >
          <div class="co21-infoscreen-splash__time" :style="accentStyle">
            <span class="co21-infoscreen-splash__hours">{{ timeParts.hours }}</span>
            <span class="co21-infoscreen-splash__colon">:</span>
            <span class="co21-infoscreen-splash__minutes">{{ timeParts.minutes }}</span>
          </div>
          <div class="co21-infoscreen-splash__date">{{ dateLine }}</div>
        </div>
      </Transition>

      <div
        v-if="showProgress"
        class="co21-infoscreen-progress"
        :aria-hidden="showClockSplash ? 'true' : undefined"
      >
        <div
          class="co21-infoscreen-progress__fill"
          :style="{ width: `${progressPercent}%`, backgroundColor: accentColor }"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { formatAppMonthLong, formatAppWeekday } from 'src/modules/lang/dateFormat';
import { formatClockSplashTime } from '../infoscreenClockSchedule';
import { dispatchInfoscreenDismissSplash } from '../infoscreenUi';
import CC from 'src/CCAccess';
import { useGroupColor } from 'src/composables/useGroupColor';

const props = defineProps<{
  visible: boolean;
  showClockSplash: boolean;
  progress: number;
}>();

const now = ref(new Date());
/** Keeps overlay mounted until fade-out finishes (fixes instant cut when infoscreen is off). */
const splashLeaving = ref(false);
let leaveEndTimer: ReturnType<typeof setTimeout> | null = null;
let leaveDepth = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const shellVisible = computed(
  () => props.visible || props.showClockSplash || splashLeaving.value,
);

const { activeGroupColor } = useGroupColor(
  CC.group.list.all as any,
  CC.group.active.activeGroup as any,
);

const accentColor = computed(() => activeGroupColor.value || '#1976d2');

const accentStyle = computed(() => ({
  color: accentColor.value,
}));

const timeParts = computed(() => formatClockSplashTime(now.value));

const dateLine = computed(() => {
  const d = now.value;
  const weekday = formatAppWeekday(d, 'long');
  const month = formatAppMonthLong(d);
  return `${weekday}, ${d.getDate()}. ${month} ${d.getFullYear()}`;
});

const splashAriaLabel = computed(() => `${timeParts.value.hours}:${timeParts.value.minutes}`);

const showProgress = computed(() => props.visible && !props.showClockSplash && !splashLeaving.value);

const progressPercent = computed(() =>
  Math.min(100, Math.max(0, Math.round(props.progress * 100))),
);

function onSplashTap(): void {
  if (!props.showClockSplash) return;
  dispatchInfoscreenDismissSplash();
}

function onSplashLeaveStart(): void {
  leaveDepth += 1;
  splashLeaving.value = true;
  if (leaveEndTimer) {
    clearTimeout(leaveEndTimer);
    leaveEndTimer = null;
  }
}

function onSplashLeaveEnd(): void {
  leaveDepth = Math.max(0, leaveDepth - 1);
  if (leaveDepth > 0) return;
  leaveEndTimer = setTimeout(() => {
    splashLeaving.value = false;
    leaveEndTimer = null;
  }, 50);
}

watch(
  () => props.showClockSplash,
  (on) => {
    if (on) {
      splashLeaving.value = false;
      leaveDepth = 0;
      now.value = new Date();
    }
  },
);

onMounted(() => {
  clockTimer = setInterval(() => {
    if (props.showClockSplash) now.value = new Date();
  }, 1000);
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (leaveEndTimer) clearTimeout(leaveEndTimer);
});
</script>

<style scoped lang="scss">
.co21-infoscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 10040;
  pointer-events: none;
}

.co21-infoscreen-overlay--splash {
  pointer-events: auto;
}

.co21-infoscreen-splash-backdrop {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 0;
}

.co21-infoscreen-splash-content {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(1rem, 4vmin, 2.5rem);
  padding: 0 5vw;
  cursor: pointer;
}

.co21-infoscreen-splash__time {
  display: flex;
  align-items: baseline;
  justify-content: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 0.92;
  letter-spacing: -0.02em;
  font-size: clamp(6rem, 42vmin, 28rem);
  text-shadow: 0 0 80px rgba(255, 255, 255, 0.1);
}

.co21-infoscreen-splash__colon {
  opacity: 0.88;
  padding: 0 0.04em;
  font-size: 0.92em;
}

.co21-infoscreen-splash__date {
  font-size: clamp(1.35rem, 5.5vmin, 3rem);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.78);
  text-align: center;
  line-height: 1.35;
  max-width: 92vw;
}

.co21-infoscreen-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
}

.co21-infoscreen-progress__fill {
  height: 100%;
  transition: width 1s linear;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.25);
}

/* Black screen fade */
.infoscreen-backdrop-enter-active {
  transition: opacity 1.1s ease-out;
}

.infoscreen-backdrop-leave-active {
  transition: opacity 1.25s ease-in;
}

.infoscreen-backdrop-enter-from,
.infoscreen-backdrop-leave-to {
  opacity: 0;
}

/* Time + date: stronger fade + move (staggered) */
.infoscreen-content-enter-active .co21-infoscreen-splash__time {
  animation: infoscreen-time-in 1.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.infoscreen-content-enter-active .co21-infoscreen-splash__date {
  animation: infoscreen-date-in 1.35s cubic-bezier(0.16, 1, 0.3, 1) 0.22s both;
}

.infoscreen-content-leave-active .co21-infoscreen-splash__time {
  animation: infoscreen-time-out 1.15s ease-in both;
}

.infoscreen-content-leave-active .co21-infoscreen-splash__date {
  animation: infoscreen-date-out 1.1s ease-in 0.08s both;
}

@keyframes infoscreen-time-in {
  from {
    opacity: 0;
    transform: scale(0.78) translateY(56px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
}

@keyframes infoscreen-date-in {
  from {
    opacity: 0;
    transform: translateY(28px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@keyframes infoscreen-time-out {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
  to {
    opacity: 0;
    transform: scale(0.88) translateY(-40px);
    filter: blur(8px);
  }
}

@keyframes infoscreen-date-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-24px);
  }
}
</style>
