<template>
  <span class="infoscreen-host-anchor" aria-hidden="true" hidden />
  <InfoscreenOverlay
    v-if="settings.variant === 'wall-clock'"
    :visible="enabled"
    :show-clock-splash="showClockSplash"
    :progress="progress"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  INFOSCREEN_CHANGED_EVENT,
  loadInfoscreenSettings,
  defaultInfoscreenSettings,
  type InfoscreenSettings,
} from '../index';
import { setInfoscreenModeClasses, useInfoscreenDrift } from '../composables/useInfoscreenDrift';
import { useInfoscreenWallClock } from '../composables/useInfoscreenWallClock';
import InfoscreenOverlay from './InfoscreenOverlay.vue';

const enabled = ref(false);
const settings = ref<InfoscreenSettings>(defaultInfoscreenSettings());

const driftActive = computed(
  () => enabled.value && settings.value.variant === 'layout-drift',
);

useInfoscreenDrift({ active: driftActive });

const { progress, showClockSplash, locked } = useInfoscreenWallClock({
  active: enabled,
  settings,
});

function applyModeClasses(): void {
  setInfoscreenModeClasses({
    enabled: enabled.value,
    variant: settings.value.variant,
    locked: locked.value,
  });
}

watch([enabled, settings, locked], () => applyModeClasses(), { deep: true, immediate: true });

function applySettings(next: InfoscreenSettings): void {
  settings.value = { ...next };
}

async function refreshSettings(): Promise<void> {
  applySettings(await loadInfoscreenSettings());
}

function onInfoscreenChanged(ev: Event): void {
  const detail = (ev as CustomEvent<InfoscreenSettings>).detail;
  if (detail && typeof detail.enabled === 'boolean') {
    applySettings(detail);
    return;
  }
  void refreshSettings();
}

onMounted(() => {
  void refreshSettings();
  window.addEventListener(INFOSCREEN_CHANGED_EVENT, onInfoscreenChanged as EventListener);
});

onBeforeUnmount(() => {
  window.removeEventListener(INFOSCREEN_CHANGED_EVENT, onInfoscreenChanged as EventListener);
  setInfoscreenModeClasses({ enabled: false, variant: '', locked: false });
});
</script>
