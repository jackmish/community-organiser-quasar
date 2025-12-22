<template>
  <q-btn-toggle
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :options="options"
    size="sm"
    unelevated
  />
</template>

<script setup lang="ts">
import { toRef, computed } from 'vue';

const props = defineProps<{ modelValue?: string; allowedModes?: string[] }>();
const emit = defineEmits(['update:modelValue']);

const modelValue = toRef(props, 'modelValue');

const labelMap: Record<string, string> = {
  add: 'Add new thing',
  edit: 'Edit thing',
  preview: 'Preview',
};

const defaultModes = ['add', 'edit', 'preview'];

const options = computed(() => {
  const modes = props.allowedModes && props.allowedModes.length ? props.allowedModes : defaultModes;
  return modes.map((m) => ({ label: labelMap[m] || m, value: m }));
});
</script>
