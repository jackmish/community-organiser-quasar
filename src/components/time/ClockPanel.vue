<template>
  <div
    v-if="clockEnabled"
    class="clock-panel"
    :class="{ 'clock-panel--colorize': panelTheme.colorize }"
    :style="panelStyle"
  >
    <ClockTimerBar class="clock-panel__timer" />
    <div class="clock-panel__body">
      <div class="row items-center no-wrap clock-panel__row">
      <div class="clock-panel__time-col">
        <div class="clock-panel__time">{{ timeText }}</div>
      </div>
      <div class="clock-panel__date-col">
        <div class="clock-panel__date-primary">
          <span>{{ dateWeekday }}</span>
          <span>{{ dateDay }}</span>
        </div>
        <div class="clock-panel__date-secondary">{{ dateMonthYear }}</div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { getLocale } from 'src/modules/lang';
import { formatAppMonthLong, formatAppWeekday } from 'src/modules/lang/dateFormat';
import CC from 'src/CCAccess';
import {
  buildCo21SurfaceThemeInputFromGroup,
  getCo21SurfaceBackgroundStyle,
} from 'src/components/theme';
import {
  readGroupBackgroundFields,
  isGroupBackgroundColorizeActive,
} from 'src/modules/group/utils/groupBackground';
import { getContrastColor } from 'src/utils/colorUtils';
import {
  CLOCK_SYNC_CHANGED_EVENT,
  loadClockSyncEnabled,
} from 'src/modules/time/clockSyncSettings';
import ClockTimerBar from './ClockTimerBar.vue';

const PANEL_DEFAULT_BG = 'rgba(2, 119, 189, 0.82)';
const PANEL_DEFAULT_HEX = '#0277bd';
const PANEL_DEFAULT_FG = '#ffffff';

const clockEnabled = ref(false);
const now = ref(new Date());
let tickTimer: ReturnType<typeof setInterval> | null = null;

const groupThemeRevision = ref(0);

watch(
  () => [CC.group.list.all.value, CC.group.active.activeGroup.value] as const,
  () => {
    groupThemeRevision.value += 1;
  },
  { deep: true },
);

function resolveActiveGroupRecord(): Record<string, unknown> | null {
  try {
    const gid = CC.group.active.activeGroup.value?.value ?? null;
    if (!gid) return null;
    const list = CC.group.list.all.value ?? [];
    const g = list.find((x) => String(x?.id) === String(gid));
    return g && typeof g === 'object' ? (g as unknown as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const panelTheme = computed(() => {
  void groupThemeRevision.value;
  const group = resolveActiveGroupRecord();
  const colorize = isGroupBackgroundColorizeActive(group);
  const { color, textColor } = readGroupBackgroundFields(group);
  const fg = textColor || getContrastColor(color);
  return { colorize, color, fg };
});

const surfaceThemeInput = computed(() => {
  void groupThemeRevision.value;
  const fromGroup = buildCo21SurfaceThemeInputFromGroup(resolveActiveGroupRecord());
  if (fromGroup) return fromGroup;
  return {
    baseHex: PANEL_DEFAULT_HEX,
    textHex: PANEL_DEFAULT_FG,
    panelHex: PANEL_DEFAULT_HEX,
  };
});

const panelStyle = computed(() => {
  const input = surfaceThemeInput.value;
  if (!panelTheme.value.colorize) {
    return {
      backgroundColor: PANEL_DEFAULT_BG,
      '--clock-panel-fg': PANEL_DEFAULT_FG,
      '--clock-timer-thumb-bg': PANEL_DEFAULT_HEX,
    };
  }
  const { fg } = panelTheme.value;
  const { backgroundColor } = getCo21SurfaceBackgroundStyle(input);
  return {
    backgroundColor,
    '--clock-panel-fg': fg,
    '--clock-timer-thumb-bg': panelTheme.value.color || PANEL_DEFAULT_HEX,
  };
});

const timeText = computed(() =>
  new Intl.DateTimeFormat(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now.value),
);

const dateWeekday = computed(() => formatAppWeekday(now.value, 'long'));

const dateDay = computed(() => String(now.value.getDate()));

const dateMonthYear = computed(() => {
  const date = now.value;
  const month = formatAppMonthLong(date);
  const year = date.getFullYear();
  return `${month} ${year}`;
});

function tick(): void {
  now.value = new Date();
}

function onClockSyncChanged(ev: Event): void {
  const ce = ev as CustomEvent<{ enabled?: boolean }>;
  clockEnabled.value = !!ce.detail?.enabled;
  if (clockEnabled.value) {
    tick();
    startTickTimer();
  } else {
    stopTickTimer();
  }
}

function startTickTimer(): void {
  stopTickTimer();
  tickTimer = setInterval(tick, 1000);
}

function stopTickTimer(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

onMounted(async () => {
  clockEnabled.value = await loadClockSyncEnabled();
  if (clockEnabled.value) {
    tick();
    startTickTimer();
  }
  window.addEventListener(CLOCK_SYNC_CHANGED_EVENT, onClockSyncChanged as EventListener);
});

onBeforeUnmount(() => {
  stopTickTimer();
  window.removeEventListener(CLOCK_SYNC_CHANGED_EVENT, onClockSyncChanged as EventListener);
});
</script>

<style scoped>
.clock-panel {
  padding: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--clock-panel-fg, #ffffff);
}

.clock-panel__body {
  padding: 20px 32px 28px;
}

@media (max-width: 1439px) {
  .clock-panel {
    overflow: visible;
  }
}

.clock-panel--colorize {
  border-top-color: rgba(0, 0, 0, 0.12);
}

.clock-panel__row {
  gap: 14px;
}

.clock-panel__time-col {
  flex-shrink: 0;
}

.clock-panel__time {
  font-size: 4.5rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.clock-panel__date-col {
  min-width: 0;
  flex: 1 1 auto;
  text-align: left;
  overflow: hidden;
}

.clock-panel__date-primary {
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  gap: 0.35em;
  font-size: 1.85rem;
  font-weight: 700;
  line-height: 1.1;
  white-space: nowrap;
}

.clock-panel__date-secondary {
  margin-top: 0.15em;
  font-size: 1.1rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0.88;
}
</style>
