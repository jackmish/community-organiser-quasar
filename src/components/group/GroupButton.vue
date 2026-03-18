<template>
  <q-btn
    dense
    rounded
    unelevated
    class="group-button"
    :class="{ selected: selected }"
    :title="title"
    :style="btnStyle"
    @click.stop.prevent="$emit('click')"
  >
    <q-icon
      :name="group?.icon || 'folder_open'"
      :style="`color: ${textColor} !important; fill: ${textColor} !important; stroke: ${textColor} !important;`"
    />
    <span :style="{ color: textColor }" class="label-text">{{ label }}</span>
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  group?: any;
  selected?: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const label = computed(() => {
  if (!props.group) return '';
  return props.group.name ?? props.group.label ?? '';
});

const textColor = computed(() => {
  try {
    if (!props.group) return 'inherit';
    return (
      props.group.textColor ||
      props.group.text_color ||
      (props.group.color ? getContrastColorLocal(props.group.color) : 'inherit')
    );
  } catch (e) {
    return 'inherit';
  }
});

function getContrastColorLocal(hex: string) {
  try {
    const rgb = hexToRgbLocal(hex);
    if (!rgb) return '#000';
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.6 ? '#000' : '#fff';
  } catch (e) {
    return '#000';
  }
}

function hexToRgbLocal(hex: string) {
  if (!hex) return null;
  const h = String(hex).replace(/^#/, '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

const btnStyle = computed(() => {
  try {
    const base = props.group?.color || 'transparent';
    const border = props.group?.color ? darkenHex(props.group.color, 0.35) : 'transparent';
    return `background-color: ${base} !important; border:1px solid ${border}; padding: 2px 8px; min-height: 24px; display: inline-flex; align-items: center; gap: 8px; background-image: none !important; box-shadow: none !important;`;
  } catch (e) {
    return '';
  }
});

function darkenHex(hex: string, amount: number) {
  try {
    const h = String(hex).replace(/^#/, '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    const r = Math.round(((num >> 16) & 255) * (1 - amount));
    const g = Math.round(((num >> 8) & 255) * (1 - amount));
    const b = Math.round((num & 255) * (1 - amount));
    return '#' + [r,g,b].map(n => n.toString(16).padStart(2,'0')).join('');
  } catch (e) {
    return hex;
  }
}

</script>

<style scoped>
.group-button {
  border-radius: 6px;
  padding: 2px 6px !important;
  font-size: 0.88rem;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
}
.group-button .label-text {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-button.selected {
  opacity: 1;
  filter: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  outline-offset: 2px;
  outline: none;
  pointer-events: none;
  cursor: default;
}
</style>
