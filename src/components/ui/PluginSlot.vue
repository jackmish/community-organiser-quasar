<template>
  <!-- Renders every plugin component registered for this slot, in priority order. -->
  <template v-if="pluginsEnabled">
    <component
      :is="comp"
      v-for="(comp, i) in components"
      :key="i"
    />
  </template>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { getSlotComponents } from 'src/plugins/pluginRegistry';
import {
  PLUGINS_SYNC_CHANGED_EVENT,
  loadPluginsSyncEnabled,
} from 'src/modules/plugins/pluginSyncSettings';

const props = defineProps<{
  /** Must match the `slot` field in plugins.config.ts */
  name: string;
}>();

const pluginsEnabled = ref(false);

const components = computed(() =>
  pluginsEnabled.value ? getSlotComponents(props.name) : [],
);

function onPluginsSyncChanged(ev: Event): void {
  const ce = ev as CustomEvent<{ enabled?: boolean }>;
  pluginsEnabled.value = !!ce.detail?.enabled;
}

onMounted(async () => {
  pluginsEnabled.value = await loadPluginsSyncEnabled();
  window.addEventListener(PLUGINS_SYNC_CHANGED_EVENT, onPluginsSyncChanged as EventListener);
});

onBeforeUnmount(() => {
  window.removeEventListener(PLUGINS_SYNC_CHANGED_EVENT, onPluginsSyncChanged as EventListener);
});
</script>
