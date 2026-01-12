<template>
  <div class="row" style="gap: 8px">
    <q-btn
      v-for="opt in options"
      :key="opt.value"
      :label="opt.label"
      :icon="opt.icon"
      size="md"
      class="q-pa-none"
      :unelevated="modelValue === opt.value"
      :outline="modelValue !== opt.value"
      @click="emit('update:modelValue', opt.value)"
      :style="{
        backgroundColor: modelValue === opt.value ? opt.color : 'transparent',
        color:
          modelValue === opt.value ? opt.textColor || 'white' : opt.color || 'rgba(0,0,0,0.87)',
        borderColor: opt.color,
        width: 'auto',
        padding: '6px 14px',
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { toRef, computed } from 'vue';

const props = defineProps<{ modelValue?: string; allowedModes?: string[] }>();
const emit = defineEmits(['up :modelValue']);

const modelValue = toRef(props, 'modelValue');

const labelMap: Record<string, string> = {
  add: 'Add new',
  edit: 'Edit',
  preview: 'Preview',
};

const iconMap: Record<string, string> = {
  add: 'add',
  edit: 'edit',
  preview: 'visibility',
};

const colorMap: Record<string, string> = {
  add: '#4caf50', // green
  edit: '#ff9800', // orange
  preview: '#2196f3', // blue
};

const textColorMap: Record<string, string> = {
  add: 'white',
  edit: 'white',
  preview: 'white',
};

const defaultModes = ['add', 'edit', 'preview'];

const options = computed(() => {
  const modes = props.allowedModes && props.allowedModes.length ? props.allowedModes : defaultModes;
  return modes.map((m) => ({
    label: labelMap[m] || m,
    value: m,
    icon: iconMap[m] || '',
    color: colorMap[m] || undefined,
    textColor: textColorMap[m] || undefined,
  }));
});
</script>
