<template>
  <div
    class="local-backend-pill"
    :class="[
      pillClass,
      variant === 'menu' ? 'local-backend-pill--menu' : 'local-backend-pill--header',
    ]"
  >
    <q-icon :name="row.linkIcon" size="16px" class="local-backend-pill__link" />
    <div class="local-backend-pill__labels">
      <span class="local-backend-pill__line">{{ row.shortLine1 }}</span>
      <span v-if="row.shortLine2" class="local-backend-pill__line">{{ row.shortLine2 }}</span>
    </div>
    <button
      v-if="showStart"
      type="button"
      class="local-backend-pill__action local-backend-pill__action--start"
      :disabled="busy"
      :aria-label="$text('accounts.backend_server_start')"
      :title="$text('accounts.backend_server_start')"
      @click.stop="onStart"
    >
      <q-icon name="play_arrow" size="14px" />
    </button>
    <button
      v-else-if="showStop"
      type="button"
      class="local-backend-pill__action local-backend-pill__action--stop"
      :disabled="busy"
      :aria-label="$text('accounts.backend_server_stop')"
      :title="$text('accounts.backend_server_stop')"
      @click.stop="onStop"
    >
      <q-icon name="stop" size="12px" />
    </button>
    <q-tooltip anchor="bottom middle" self="top middle">{{ row.name }}</q-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import { appNotify } from 'src/utils/appNotify';
import {
  DEVICE_DISCONNECTED_BORDER,
  DEVICE_DISCONNECTED_FG,
  type DeviceStatusRow,
} from 'src/utils/deviceStatusDisplay';
import { useCo21AiServer } from 'src/modules/ai/composables/useCo21AiServer';

const props = withDefaults(
  defineProps<{
    row: DeviceStatusRow;
    variant?: 'header' | 'menu';
  }>(),
  { variant: 'header' },
);

const emit = defineEmits<{
  changed: [];
}>();

const { running, busy, lastError, start, stop } = useCo21AiServer();

const showStart = computed(() => props.row.status === 'disconnected');
const showStop = computed(() => props.row.status === 'connected' && running.value);

const pillClass = computed(() => {
  const status = props.row.status;
  if (status === 'checking') return 'local-backend-pill--checking';
  if (status === 'connected') return 'local-backend-pill--on';
  return 'local-backend-pill--off';
});

const disconnectedBorder = DEVICE_DISCONNECTED_BORDER;
const disconnectedFg = DEVICE_DISCONNECTED_FG;

async function onStart(): Promise<void> {
  const ok = await start();
  if (!ok) {
    appNotify('negative', lastError.value || $text('accounts.backend_server_start_failed'));
  }
  emit('changed');
}

async function onStop(): Promise<void> {
  await stop();
  emit('changed');
}
</script>

<style scoped>
.local-backend-pill {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  flex-shrink: 0;
  background: #fff !important;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 0;
}

.local-backend-pill--header {
  padding: 3px 4px 3px 6px;
  min-width: 52px;
  font-size: 9px;
  line-height: 1.05;
}

.local-backend-pill--menu {
  padding: 4px 4px 4px 8px;
  min-width: 56px;
  font-size: 10px;
  line-height: 1.05;
}

.local-backend-pill__labels {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
  min-width: 0;
}

.local-backend-pill__line {
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.local-backend-pill__link {
  flex-shrink: 0;
}

.local-backend-pill__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 2px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  line-height: 0;
  appearance: none;
}

.local-backend-pill__action:disabled {
  opacity: 0.55;
  cursor: wait;
}

.local-backend-pill__action--start {
  background: #15803d;
  color: #fff;
}

.local-backend-pill__action--start :deep(.q-icon) {
  color: #fff !important;
}

.local-backend-pill__action--stop {
  background: v-bind(disconnectedFg);
  color: #fff;
}

.local-backend-pill__action--stop :deep(.q-icon) {
  color: #fff !important;
}

.local-backend-pill--on {
  border-color: #16a34a;
  color: #16a34a;
}

.local-backend-pill--off {
  border-color: v-bind(disconnectedBorder);
  color: v-bind(disconnectedFg);
}

.local-backend-pill--checking {
  border-color: #2563eb;
  color: #2563eb;
}

.local-backend-pill--on .local-backend-pill__link,
.local-backend-pill--off .local-backend-pill__link,
.local-backend-pill--checking .local-backend-pill__link {
  color: inherit;
}

.local-backend-pill--checking .local-backend-pill__link {
  animation: local-backend-pill-spin 1.1s linear infinite;
}

@keyframes local-backend-pill-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
