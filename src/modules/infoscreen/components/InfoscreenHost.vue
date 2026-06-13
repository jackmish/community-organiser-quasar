<template>
  <span class="infoscreen-host-anchor" aria-hidden="true" hidden />
  <InfoscreenOverlay
    :visible="screensaverActive"
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

const settings = ref<InfoscreenSettings>(defaultInfoscreenSettings());

const presentationActive = computed(() => settings.value.presentationEnabled);
const screensaverActive = computed(() => settings.value.screensaverEnabled);

useInfoscreenDrift({ active: presentationActive });

const { progress, showClockSplash, locked } = useInfoscreenWallClock({
  active: screensaverActive,
  settings,
});

function applyModeClasses(): void {
  setInfoscreenModeClasses({
    presentationEnabled: settings.value.presentationEnabled,
    screensaverEnabled: settings.value.screensaverEnabled,
    locked: locked.value,
  });
}

watch([settings, locked], () => applyModeClasses(), { deep: true, immediate: true });

function applySettings(next: InfoscreenSettings): void {
  settings.value = { ...next };
}

async function refreshSettings(): Promise<void> {
  applySettings(await loadInfoscreenSettings());
}

function isInfoscreenSettingsDetail(detail: unknown): detail is InfoscreenSettings {
  if (!detail || typeof detail !== 'object') return false;
  const d = detail as Partial<InfoscreenSettings>;
  return (
    typeof d.presentationEnabled === 'boolean' && typeof d.screensaverEnabled === 'boolean'
  );
}

function onInfoscreenChanged(ev: Event): void {
  const detail = (ev as CustomEvent<InfoscreenSettings>).detail;
  if (isInfoscreenSettingsDetail(detail)) {
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
  setInfoscreenModeClasses({
    presentationEnabled: false,
    screensaverEnabled: false,
    locked: false,
  });
});
</script>
