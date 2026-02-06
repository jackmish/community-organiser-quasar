<template>
  <q-card flat class="q-pa-sm q-mb-md" style="background: transparent; border-radius: 8px">
    <div class="row items-center" style="gap: 8px">
      <q-icon name="check" color="grey-7" />
      <div class="text-subtitle2"><strong>Done</strong></div>
    </div>
    <div class="q-mt-sm done-items-grid">
      <div
        v-for="d in props.doneTasks"
        :key="d.id"
        :class="[{ 'done-item': true, 'done-item--has-bg': hasBg(d) }]"
        :style="getDoneItemStyle(d)"
        @click="onDoneClick(d)"
      >
        <div class="row items-center justify-between" style="gap: 8px">
          <div class="row items-center" style="gap: 8px">
            <q-icon :name="getIcon(d)" :style="{ color: getIconColor(d) }" />
            <div
              :class="{ 'text-strike': Number(d.status_id) === 0 && d.timeMode !== 'prepare' }"
              :style="{ color: getTextColor(d) }"
            >
              {{ getDisplayName(d) }}
            </div>
          </div>
          <div class="row items-center" style="gap: 8px">
            <div
              class="priority-indicator"
              :style="{
                backgroundColor: priorityColor(d.priority),
                borderColor: priorityColor(d.priority),
              }"
            />
            <q-icon name="done" size="18px" :style="{ color: getIconColor(d) }" />
          </div>
        </div>
      </div>
    </div>
  </q-card>
</template>

<script setup lang="ts">
// Props + emits
const props = defineProps<{
  doneTasks: any[];
}>();

const emit = defineEmits<{
  (e: 'toggle-status', task: any): void;
}>();

function onDoneClick(task: any) {
  emit('toggle-status', task);
}

// Utility functions for priority colors and replenish color sets
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  priorityDefinitions as themePriorityDefinitions,
  findReplenishSet,
  getReplenishBg,
  getReplenishText,
} from '../theme';
import { typeIcons } from '../theme';
import { getCycleType } from 'src/modules/task/utlils/occursOnDay';

// Replenish color data imported from theme

const priorityColor = (priority: any) => themePriorityColors[priority] || 'transparent';
const priorityTextColor = (priority: any) => themePriorityTextColor(priority);

const isCyclic = (task: any) => {
  try {
    return Boolean(getCycleType(task)) || Boolean(task && task.__isCyclicInstance);
  } catch (e) {
    return Boolean(task && task.__isCyclicInstance);
  }
};

const getIcon = (task: any) => {
  if (!task) return 'task';
  // Prefer icons defined in the shared theme mapping
  try {
    const t = task.type_id || task.type || '';
    if (t && typeIcons[t]) return typeIcons[t];
  } catch (e) {
    // ignore and fall back
  }
  if (isCyclic(task)) return 'repeat';
  if (task.eventTime) return 'event';
  return 'label';
};

const getDisplayName = (task: any) => {
  if (!task) return '';
  const name = task.name || '';
  try {
    if (Number(task.status_id) === 0 && task.timeMode === 'prepare') {
      return `${name} [prepared]`;
    }
  } catch (e) {
    // ignore
  }
  return name;
};

const getIconColor = (task: any) => {
  if (!task) return 'grey-6';
  if (task.type_id === 'Replenish') {
    const s = findReplenishSet(task.color_set);
    return s ? s.text : '#000000';
  }
  // If the done item has a custom background, prefer theme's priority text color
  if (hasBg(task)) return priorityTextColor(task.priority) || '#000000';
  // Prefer the priority color for icon fill if available, otherwise use a high-contrast dark
  return priorityColor(task.priority) || 'rgba(0,0,0,0.87)';
};

const getTextColor = (task: any) => {
  if (!task) return 'rgba(0,0,0,0.87)';
  if (task.type_id === 'Replenish') {
    const s = findReplenishSet(task.color_set);
    return s ? s.text : 'rgba(0,0,0,0.87)';
  }
  // If the done item has a custom background, return contrasting text
  if (hasBg(task)) {
    // Use the theme's priority text color for readability on priority backgrounds
    return (
      priorityTextColor(task.priority) ||
      (priorityColor(task.priority)
        ? getContrastColor(priorityColor(task.priority))
        : 'rgba(0,0,0,0.87)')
    );
  }
  // Prefer the priority text color when available
  const pt = priorityTextColor(task.priority);
  return pt || 'rgba(0,0,0,0.87)';
};

const getDoneItemStyle = (task: any) => {
  if (!task) return {};
  if (task.type_id === 'Replenish') {
    const s = findReplenishSet(task.color_set);
    if (s) return { backgroundColor: s.bg, color: s.text };
  }
  // Style completed non-Replenish items (Todo, TimeEvent, Note, etc.) using their priority color
  if (task.type_id !== 'Replenish') {
    const bg = priorityColor(task.priority) || 'transparent';
    const text = priorityTextColor(task.priority) || getContrastColor(bg);
    return { backgroundColor: bg, color: text };
  }
  // For cyclic finished occurrences show priority color lightly as bg
  try {
    if (isCyclic(task)) {
      const bg = priorityColor(task.priority) || 'transparent';
      // Use the priority color as a subtle background and choose contrasting text
      const text = getContrastColor(bg);
      return { backgroundColor: bg, color: text };
    }
  } catch (e) {
    // ignore
  }
  return {};
};

// Helper to detect if a task will render with a custom background (replenish or cyclic using priority)
const hasBg = (task: any) => {
  if (!task) return false;
  if (task.type_id === 'Replenish') {
    const s = findReplenishSet(task.color_set);
    return !!s;
  }
  // Treat completed non-Replenish items as having a priority background for consistent styling
  if (task.type_id !== 'Replenish') {
    const bg = priorityColor(task.priority) || '';
    return !!bg && bg !== 'transparent';
  }
  // Also treat generated cyclic instances as cyclic so they get priority styling
  if (isCyclic(task)) {
    const bg = priorityColor(task.priority) || '';
    return !!bg && bg !== 'transparent';
  }
  return false;
};

// Returns either '#000000' or '#ffffff' for sufficient contrast against given hex bg
const getContrastColor = (hex: string) => {
  if (!hex) return '#000000';
  // Normalize hex
  const h = hex.replace('#', '');
  const bigint = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  // Perceived luminance
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum > 0.6 ? '#000000' : '#ffffff';
};
</script>

<style scoped>
.done-item {
  /* Light desaturation for done items while preserving readability */
  filter: grayscale(10%);
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  width: 100%;
}

.done-items-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.done-item--has-bg {
  /* When an item has a custom background, keep original colors and remove grayscale */
  filter: none;
}

.priority-indicator {
  width: 14px;
  height: 14px;
  min-width: 14px;
  border-radius: 50%;
  border: 1px solid transparent;
}
</style>
