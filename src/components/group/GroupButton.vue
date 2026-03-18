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
import { getContrastColor, darkenHex } from 'src/utils/colorUtils';

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
      (props.group.color ? getContrastColor(props.group.color) : 'inherit')
    );
  } catch (e) {
    return 'inherit';
  }
});


const btnStyle = computed(() => {
  try {
    const base = props.group?.color || 'transparent';
    const border = props.group?.color ? darkenHex(props.group.color, 0.35) : 'transparent';
    return `background-color: ${base} !important; border:1px solid ${border}; padding: 2px 8px; min-height: 24px; display: inline-flex; align-items: center; gap: 8px; background-image: none !important; box-shadow: none !important;`;
  } catch (e) {
    return '';
  }
});

// using shared color helpers from src/utils/colorUtils

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
