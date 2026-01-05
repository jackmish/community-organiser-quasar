<template>
  <q-card flat class="q-pa-sm q-mb-md" style="background: transparent; border-radius: 8px">
    <div class="row items-center" style="gap: 8px">
      <q-icon name="check" color="grey-7" />
      <div class="text-subtitle2"><strong>Done</strong></div>
    </div>
    <div class="q-mt-sm">
      <div
        v-for="d in props.doneTasks"
        :key="d.id"
        :class="[{ 'done-item': true, 'done-item--has-bg': hasBg(d) }]"
        :style="getDoneItemStyle(d)"
        @click="onDoneClick(d)"
      >
        <div class="row items-center justify-between" style="gap: 8px">
          <div class="row items-center" style="gap: 8px">
            <q-icon :name="getIcon(d)" :color="getIconColor(d)" />
            <div
              :class="{ 'text-strike': Number(d.status_id) === 0 }"
              :style="{ color: getTextColor(d) }"
            >
              {{ d.name }}
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
            <q-icon name="done" size="18px" color="grey-6" />
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
} from './theme';

const replenishColorSets = [
  { id: 'set-1', bg: '#b71c1c', text: '#ffffff' },
  { id: 'set-4', bg: '#ff5252', text: '#000000' },
  { id: 'set-3', bg: '#ff8a80', text: '#000000' },
  { id: 'set-5', bg: '#fdd835', text: '#000000' },
  { id: 'set-8', bg: '#ffeb3b', text: '#000000' },
  { id: 'set-6', bg: '#fff176', text: '#000000' },
  { id: 'set-9', bg: '#2e7d32', text: '#ffffff' },
  { id: 'set-11', bg: '#9ccc65', text: '#000000' },
  { id: 'set-12', bg: '#a5d6a7', text: '#000000' },
  { id: 'set-13', bg: '#00acc1', text: '#ffffff' },
  { id: 'set-15', bg: '#80deea', text: '#000000' },
  { id: 'set-16', bg: '#b2ebf2', text: '#000000' },
  { id: 'set-17', bg: '#0d47a1', text: '#ffffff' },
  { id: 'set-18', bg: '#1976d2', text: '#ffffff' },
  { id: 'set-20', bg: '#90caf9', text: '#000000' },
  { id: 'set-21', bg: '#6a1b9a', text: '#ffffff' },
  { id: 'set-23', bg: '#ab47bc', text: '#ffffff' },
  { id: 'set-24', bg: '#ce93d8', text: '#000000' },
  { id: 'set-25', bg: '#000000', text: '#ffffff' },
  { id: 'set-27', bg: '#9e9e9e', text: '#000000' },
  { id: 'set-28', bg: '#ffffff', text: '#000000' },
];

const findReplenishSet = (id?: string | null) => {
  if (!id) return null;
  return replenishColorSets.find((s) => s.id === id) || null;
};

const priorityColor = (priority: any) => themePriorityColors[priority] || 'transparent';
const priorityTextColor = (priority: any) => themePriorityTextColor(priority);

const getIcon = (task: any) => {
  if (!task) return 'task';
  if (task.type_id === 'Replenish') return 'shopping_cart';
  if (task.repeat || task.repeatMode === 'cyclic') return 'repeat';
  if (task.eventTime) return 'event';
  return 'label';
};

const getIconColor = (task: any) => {
  if (!task) return 'grey-6';
  if (task.type_id === 'Replenish') {
    const s = findReplenishSet(task.color_set);
    return s ? s.text : '#000000';
  }
  // If the done item has a custom background, ensure icon contrasts
  if (hasBg(task)) return getContrastColor(priorityColor(task.priority) || '#ffffff');
  return priorityColor(task.priority) || '#000000';
};

const getTextColor = (task: any) => {
  if (!task) return 'rgba(0,0,0,0.45)';
  if (task.type_id === 'Replenish') {
    const s = findReplenishSet(task.color_set);
    return s ? s.text : 'rgba(0,0,0,0.45)';
  }
  // If the done item has a custom background, return contrasting text
  if (hasBg(task)) {
    const bg = priorityColor(task.priority) || '#ffffff';
    return getContrastColor(bg);
  }
  return 'rgba(0,0,0,0.45)';
};

const getDoneItemStyle = (task: any) => {
  if (!task) return {};
  if (task.type_id === 'Replenish') {
    const s = findReplenishSet(task.color_set);
    if (s) return { backgroundColor: s.bg, color: s.text };
  }
  // For cyclic finished occurrences show priority color lightly as bg
  try {
    if (task.repeat || task.repeatMode === 'cyclic') {
      const bg = priorityColor(task.priority) || 'transparent';
      // Use a low-opacity background but set explicit text color for contrast
      const text = getContrastColor(bg);
      return { backgroundColor: bg, color: text, opacity: 0.12 };
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
  if (task.repeat || task.repeatMode === 'cyclic') {
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
  filter: grayscale(100%);
  opacity: 0.9;
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}

.done-item--has-bg {
  /* When an item has a custom background, keep original colors and remove grayscale */
  filter: none;
  opacity: 1;
}

.priority-indicator {
  width: 14px;
  height: 14px;
  min-width: 14px;
  border-radius: 50%;
  border: 1px solid transparent;
}
</style>
