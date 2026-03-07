<template>
  <q-item class="q-pa-sm task-card hidden-group-item" clickable @click.stop="onSelect">
    <q-item-section>
      <div style="display: flex; align-items: center; gap: 8px; flex: 1 1 auto">
        <q-avatar
          size="40"
          :style="{ background: group.color || getGroupColor(group.id) }"
        >
          <q-icon :name="group.icon || getGroupIcon(group.id) || 'group'" size="18" color="white" />
        </q-avatar>
        <div class="title-main">
          <div class="title-text">
            <q-item-label class="title-ellipsis"><strong>{{ group.name }}</strong></q-item-label>
            <div class="text-caption">{{ group.total }} tasks</div>
          </div>
        </div>
      </div>
    </q-item-section>
    <q-item-section side>
      <div class="priority-summary-grid">
        <span
          v-if="group.critical > 0"
          class="priority-summary"
          :style="{ background: '#b71c1c', color: 'white' }"
        >
          <q-icon name="warning" size="14px" /> {{ group.critical }}
        </span>
        <span
          v-if="group.high > 0"
          class="priority-summary"
          :style="{ background: themePriorityColors.high, color: themePriorityTextColor('high') }"
        >
          <q-icon :name="themePriorityDefinitions['high']?.icon || 'priority_high'" size="14px" />
          {{ group.high }}
        </span>
        <span
          v-if="group.medium > 0"
          class="priority-summary"
          :style="{ background: themePriorityColors.medium, color: themePriorityTextColor('medium') }"
        >
          <q-icon :name="themePriorityDefinitions['medium']?.icon || 'label'" size="14px" />
          {{ group.medium }}
        </span>
        <span
          v-if="group.low > 0"
          class="priority-summary"
          :style="{ background: themePriorityColors.low, color: themePriorityTextColor('low') }"
        >
          <q-icon :name="themePriorityDefinitions['low']?.icon || 'label_outline'" size="14px" />
          {{ group.low }}
        </span>
      </div>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import * as api from 'src/modules/day-organiser/_apiRoot';
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  priorityDefinitions as themePriorityDefinitions,
} from '../theme';

const props = defineProps<{ group: any }>();
const emit = defineEmits<{
  (e: 'select', g: any): void;
}>();

const groups = api.group.list.all;

function getGroupColor(id: string | number | undefined) {
  if (!id) return '#1976d2';
  const g = groups.value.find((gg: any) => String(gg.id) === String(id));
  return g?.color || '#1976d2';
}

function getGroupIcon(id: string | number | undefined) {
  if (!id) return null;
  const g = groups.value.find((gg: any) => String(gg.id) === String(id));
  return g?.icon || null;
}

function onSelect() {
  emit('select', props.group);
}
</script>

<style scoped>
.hidden-group-item {
  padding: 0px !important;
  /* make left side appear pill-like (half-circle) */
  border-top-left-radius: 999px !important;
  border-bottom-left-radius: 999px !important;
  /* small rounding on the right side */
  border-top-right-radius: 8px !important;
  border-bottom-right-radius: 8px !important;
}
.hidden-group-avatar {
  padding-right: 8px;
}
.hidden-group-title {
  display: flex;
  flex-direction: column;
}
.hidden-group-sub {
  font-size: 11px;
  color: rgba(0,0,0,0.5);
}
.hidden-group-badges {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* Priority summary grid (moved from TasksListSmall.vue) */
.priority-summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 0;
  font-size: 12px;
}

.priority-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 0px;
  align-items: center;
  justify-items: end;
}

/* Round only the outer corners of the 2x2 grid */
.priority-summary-grid > .priority-summary:nth-child(1) {
  border-top-left-radius: 8px;
}
.priority-summary-grid > .priority-summary:nth-child(2) {
  border-top-right-radius: 8px;
}
.priority-summary-grid > .priority-summary:nth-child(3) {
  border-bottom-left-radius: 8px;
}
.priority-summary-grid > .priority-summary:nth-child(4) {
  border-bottom-right-radius: 8px;
}
</style>
