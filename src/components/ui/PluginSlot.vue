<template>
  <!-- Renders every plugin component registered for this slot, in priority order. -->
  <component
    :is="comp"
    v-for="(comp, i) in components"
    :key="i"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getSlotComponents } from 'src/plugins/pluginRegistry';

const props = defineProps<{
  /** Must match the `slot` field in plugins.config.ts */
  name: string;
}>();

const components = computed(() => getSlotComponents(props.name));
</script>
