<template>
  <div class="task-list" style="gap: 4px">
    <template v-if="tasksWithTime.length > 0">
      <q-item
        v-for="task in tasksWithTime"
        :key="task.id"
        class="q-pa-sm task-card"
        :class="{
          'bg-grey-2': Number(task.status_id) === 0,
          'selected-task': selectedTaskId === task.id,
        }"
        :style="itemStyle(task)"
        :active="selectedTaskId === task.id"
        clickable
        @pointerdown="() => startLongPress(task)"
        @pointerup="cancelLongPress"
        @pointercancel="cancelLongPress"
        @pointerleave="cancelLongPress"
        @click="handleTaskClick(task)"
      >
        <q-icon
          v-if="typeIcons[task.type_id || task.type]"
          :name="typeIcons[task.type_id || task.type]"
          class="type-watermark"
        />
        <q-item-section class="title-row">
          <div style="flex: 1 1 auto">
            <div class="title-main">
              <div class="title-text">
                <q-item-label :class="{ 'text-strike': Number(task.status_id) === 0 }">
                  <strong>{{ task.name }}</strong>
                </q-item-label>
              </div>
              <div class="title-checkbox">
                <q-checkbox
                  :model-value="Number(task.status_id) === 0"
                  @click.stop="toggleStatus(task)"
                />
              </div>
            </div>
            <q-item-label
              v-if="
                (task.type === 'event' ||
                  task.type_id === 'TimeEvent' ||
                  task.type === 'TimeEvent') &&
                getEventHoursDisplay(task)
              "
              caption
              :class="['task-desc', { 'has-date': hasDate(task) }]"
            >
              <span
                class="priority-inline"
                :title="task.priority"
                :style="{
                  backgroundColor: priorityColor(task.priority),
                  color: priorityTextColor(task.priority),
                }"
              >
                <q-icon
                  :name="themePriorityDefinitions[task.priority]?.icon || 'label'"
                  size="12px"
                />
              </span>
              {{ getEventHoursDisplay(task) }}
            </q-item-label>
          </div>
        </q-item-section>
        <q-item-section side>
          <div class="task-controls-grid">
            <div class="controls-edit">
              <q-btn flat round dense icon="edit" class="edit-btn" @click.stop="editTask(task)" />
            </div>

            <div class="group-name">{{ getGroupName(task.groupId || task.group_id) }}</div>
          </div>
        </q-item-section>

        <q-icon v-if="Number(task.status_id) === 0" class="done-floating" name="done" />
      </q-item>
    </template>

    <q-separator v-if="tasksWithTime.length > 0 && tasksWithoutTime.length > 0" class="q-my-md" />

    <template v-if="tasksWithoutTime.length > 0">
      <q-item
        v-for="task in tasksWithoutTime"
        :key="task.id"
        class="q-pa-sm task-card"
        :class="{
          'bg-grey-2': Number(task.status_id) === 0,
          'selected-task': selectedTaskId === task.id,
        }"
        :style="itemStyle(task)"
        :active="selectedTaskId === task.id"
        clickable
        @pointerdown="() => startLongPress(task)"
        @pointerup="cancelLongPress"
        @pointercancel="cancelLongPress"
        @pointerleave="cancelLongPress"
        @click="handleTaskClick(task)"
      >
        <q-icon
          v-if="typeIcons[task.type_id || task.type]"
          :name="typeIcons[task.type_id || task.type]"
          class="type-watermark"
        />
        <q-item-section class="title-row">
          <div style="flex: 1 1 auto">
            <div class="title-main">
              <div class="title-text">
                <q-item-label :class="{ 'text-strike': Number(task.status_id) === 0 }">
                  <strong>{{ task.name }}</strong>
                </q-item-label>
              </div>
              <div class="title-checkbox">
                <q-checkbox
                  :model-value="Number(task.status_id) === 0"
                  @click.stop="toggleStatus(task)"
                />
              </div>
            </div>
            <q-item-label
              v-if="
                (task.type === 'event' ||
                  task.type_id === 'TimeEvent' ||
                  task.type === 'TimeEvent') &&
                getEventHoursDisplay(task)
              "
              caption
              :class="['task-desc', { 'has-date': hasDate(task) }]"
            >
              <span
                class="priority-inline"
                :title="task.priority"
                :style="{
                  backgroundColor: priorityColor(task.priority),
                  color: priorityTextColor(task.priority),
                }"
              >
                <q-icon
                  :name="themePriorityDefinitions[task.priority]?.icon || 'label'"
                  size="12px"
                />
              </span>
              {{ getEventHoursDisplay(task) }}
            </q-item-label>
            <q-item-label v-else-if="getDisplayDescription(task)" caption class="task-desc">
              <span
                class="priority-inline"
                :title="task.priority"
                :style="{
                  backgroundColor: priorityColor(task.priority),
                  color: priorityTextColor(task.priority),
                }"
              >
                <q-icon
                  :name="themePriorityDefinitions[task.priority]?.icon || 'label'"
                  size="12px"
                /> </span
              >{{ getDisplayDescription(task) }}</q-item-label
            >
          </div>
        </q-item-section>
        <q-item-section side>
          <div class="task-controls-grid">
            <div class="controls-edit">
              <q-btn flat round dense icon="edit" class="edit-btn" @click.stop="editTask(task)" />
            </div>
            <div class="group-name">{{ getGroupName(task.groupId || task.group_id) }}</div>
          </div>
        </q-item-section>
      </q-item>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useLongPress } from '../composables/useLongPress';

const props = defineProps<{
  tasksWithTime: any[];
  tasksWithoutTime: any[];
  selectedTaskId: string | null;
}>();

const emit = defineEmits<{
  (e: 'toggle-status', task: any): void;
  (e: 'edit-task', task: any): void;
  (e: 'task-click', task: any): void;
  (e: 'delete-task', id: string): void;
}>();

const openDeleteMenu = ref<string | null>(null);

const { startLongPress, cancelLongPress, longPressTriggered, setLongPressHandler } = useLongPress();

// Bring in group and theme helpers locally so parent doesn't need to pass them
import { useDayOrganiser } from '../modules/day-organiser/useDayOrganiser';
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  priorityDefinitions as themePriorityDefinitions,
  formatEventHoursDiff,
  formatDisplayDate,
  typeIcons,
} from './theme';

const { groups } = useDayOrganiser();

setLongPressHandler((t: any) => {
  emit('edit-task', t);
});

const priorityColor = (priority: any) => themePriorityColors[priority] || 'transparent';
const priorityTextColor = (priority: any) => themePriorityTextColor(priority);

// Colors for task types (match AddTaskForm.vue)
const typeColors: Record<string, string> = {
  TimeEvent: '#2196f3', // blue
  Todo: '#4caf50', // green
  NoteLater: '#9e9e9e', // grey
  Replenish: '#ffeb3b', // yellow
};

const getGroupName = (groupId?: string) => {
  if (!groupId) return 'Unknown';
  const g = groups.value.find((gg: any) => gg.id === groupId);
  return g ? g.name : 'Unknown';
};

const getGroupColor = (groupId?: string) => {
  if (!groupId) return '#1976d2';
  const g = groups.value.find((gg: any) => gg.id === groupId);
  return g?.color || '#1976d2';
};

const getEventHoursDisplay = (task: any) => {
  const dateStr = task?.date || task?.eventDate || '';
  const timeStr = task?.eventTime || '';
  if (!dateStr) return '';
  if (timeStr) {
    // Display the actual time (HH:MM) rather than a relative difference
    return timeStr;
  }
  // No explicit time: show relative day labels when applicable
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return formatDisplayDate(dateStr);
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dateMid.getTime() - todayMid.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return formatDisplayDate(dateStr);
};

const hasDate = (task: any) => {
  // Consider a task to "have a date" if it's a time-event type or has explicit date/time
  if (!task) return false;
  if (task.type === 'event' || task.type_id === 'TimeEvent') return true;
  if (task?.eventTime) return true;
  if (task?.date || task?.eventDate) return true;
  return false;
};

const getDisplayDescription = (task: any) => {
  const desc = (task.description || '').trim();
  const name = (task.name || '').trim();
  if (!desc) return '';
  if (!name) return desc;
  if (desc === name) return '';
  if (desc.startsWith(name)) {
    const remainder = desc
      .slice(name.length)
      .replace(/^[\s\-:\u2013\u2014]+/, '')
      .trim();
    return remainder || '';
  }
  return desc;
};

const itemStyle = (task: any) => {
  if (!task) return {};
  // keep "done" items using the grey styles
  if (Number(task.status_id) === 0) return {};
  const bg = priorityColor(task.priority) || 'transparent';
  const color = priorityTextColor(task.priority) || 'inherit';
  const typeColor = typeColors[task.type_id || task.type] || 'transparent';
  return {
    backgroundColor: bg,
    color,
    borderLeft: `4px solid ${typeColor}`,
  } as Record<string, string>;
};

function handleTaskClick(task: any) {
  if (longPressTriggered.value) {
    longPressTriggered.value = false;
    return;
  }
  emit('task-click', task);
}

function toggleStatus(task: any) {
  emit('toggle-status', task);
}

function editTask(task: any) {
  emit('edit-task', task);
}

function confirmDelete(id: string) {
  openDeleteMenu.value = null;
  emit('delete-task', id);
}
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: row;
  gap: 4px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.task-card {
  min-width: 280px;
  max-width: 360px;
  flex: 0 0 320px;
}
.priority-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  margin-right: 8px;
}

.task-card {
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 18px;
  font-size: 12px;
}

.has-date {
  font-weight: 800;
}

.type-icon {
  margin-right: 6px;
  vertical-align: middle;
  display: inline-flex;
  align-items: center;
}
.priority-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  margin-right: 6px;
  font-size: 12px;
}

.type-watermark {
  position: absolute;
  left: 50%;
  top: 50%;
  /* shift slightly down to sit lower inside the card */
  transform: translate(50%, -30%) rotate(-10deg);
  font-size: 120px;
  opacity: 0.18;
  pointer-events: none;
  color: currentColor;
  z-index: 0;
}

/* ensure content appears above watermark */
.title-row,
.task-controls-grid,
.q-item-section {
  position: relative;
  z-index: 1;
}
.priority-badge q-icon {
  margin: 0 !important;
}
.badge-group-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
/* left badge next to title */
.priority-left {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  margin-right: 8px;
  flex: 0 0 auto;
  font-size: 10px;
}
.title-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px;
  flex-direction: row !important;
  position: relative;
}
.title-row > div {
  min-width: 0; /* allow text to truncate instead of pushing badge above */
  display: flex;
  flex-direction: column;
  padding-right: 0; /* checkbox is inline now */
}
.title-main {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}
.title-text {
  min-width: 0;
  display: block;
}
/* make the title label very compact */
.title-text q-item-label {
  padding: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1;
  height: 18px;
  display: inline-block;
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title-text q-item-label strong {
  font-size: 12px;
  font-weight: 600;
}
/* tighten title spacing */
.title-text q-item-label,
.title-text q-item-label strong {
  line-height: 1.05;
}
.title-row q-item-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.task-desc {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px;
  margin: 0 !important;
  max-width: 100%;
  color: inherit; /* respect item text color */
}
/* ensure truncation applies in title rows */
.title-row .task-desc {
  max-width: calc(100% - 40px);
}
.priority-left {
  vertical-align: middle;
}
/* 2x2 grid for controls: edit / delete / priority+group / done checkbox */
.task-controls-grid {
  display: grid;
  grid-template-columns: 28px 28px;
  grid-template-rows: 20px 20px;
  gap: 8px 2px; /* row-gap 8px (vertical), column-gap 2px (horizontal) */
  align-items: center;
  justify-items: center;
}
.task-controls-grid > div {
  display: flex;
  align-items: center;
  justify-content: center;
}
/* place checkbox in top-right cell */
.task-controls-grid .controls-checkbox {
  grid-column: 2;
  grid-row: 1;
}
/* place edit in top-left cell */
.task-controls-grid .controls-edit {
  grid-column: 1;
  grid-row: 1;
}
/* group name spans both columns on second row */
.task-controls-grid .group-name {
  grid-column: 1 / 3;
  grid-row: 2;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 6px;
  align-self: center;
  justify-self: center;
  background-color: rgba(8, 10, 12, 0.5); /* darker graphite at 50% opacity */
  color: #ffffff; /* white text */
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  min-width: 60px;
}
/* make edit icon inherit item text color */
.edit-btn .q-icon {
  color: rgba(0, 0, 0, 0.9) !important; /* darker icon color */
}
/* ensure the button uses a darker explicit color */
.edit-btn {
  color: rgba(0, 0, 0, 0.9) !important;
}
/* Slightly smaller text for task cards to match compact notification style */
.task-card {
  font-size: 13px;
}
.task-card strong {
  font-size: 13px;
  line-height: 1;
}
/* ensure the title label itself is compact */
.title-text q-item-label {
  font-size: 13px;
  line-height: 1;
}
.done-floating {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  pointer-events: none;
  color: inherit;
}
.selected-task {
  border-radius: 6px;
  /* visual 4px solid border (no transparency) using a static blue */
  box-shadow: 0 0 0 4px rgb(100, 181, 246);
  /* keep a slightly stronger light background tint */
  background-color: rgba(100, 181, 246, 0.06);
}
.replenish-item {
  cursor: pointer;
  border-radius: 6px;
  padding: 8px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.done-item {
  filter: grayscale(100%);
  opacity: 0.9;
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}
</style>
