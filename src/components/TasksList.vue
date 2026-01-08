<template>
  <div class="task-list">
    <template v-if="tasksWithTime.length > 0">
      <q-item
        v-for="task in tasksWithTime"
        :key="task.id"
        class="q-pa-md task-card"
        :class="{
          'bg-grey-2': Number(task.status_id) === 0,
          'selected-task': selectedTaskId === task.id,
        }"
      >
        <q-item-section class="title-row">
          <div style="flex: 1 1 auto">
            <q-item-label :class="{ 'text-strike': Number(task.status_id) === 0 }">
              <span
                class="priority-left"
                :title="task.priority"
                :style="{
                  backgroundColor: priorityColor(task.priority),
                  color: priorityTextColor(task.priority),
                }"
              >
                <q-icon
                  :name="themePriorityDefinitions[task.priority]?.icon || 'label'"
                  size="14px"
                />
              </span>
              <strong>{{ task.name }}</strong>
            </q-item-label>
          </div>
          <q-item-label v-if="getDisplayDescription(task)" caption>
            {{ getDisplayDescription(task) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="task-controls-grid">
            <div>
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                @click.stop="openDeleteMenu = openDeleteMenu === task.id ? null : task.id"
              />
              <div v-if="openDeleteMenu === task.id" class="row items-center" style="gap: 8px">
                <div>Delete?</div>
                <q-btn
                  flat
                  dense
                  color="negative"
                  label="Yes"
                  @click.stop="confirmDelete(task.id)"
                />
                <q-btn flat dense label="No" @click.stop="openDeleteMenu = null" />
              </div>
            </div>
            <div>
              <q-btn flat round dense icon="edit" color="primary" @click.stop="editTask(task)" />
            </div>

            <div>
              <q-checkbox
                :model-value="Number(task.status_id) === 0"
                @click.stop="toggleStatus(task)"
              />
            </div>
          </div>
        </q-item-section>

        <q-icon v-if="Number(task.status_id) === 0" class="done-floating" name="done" />
        <q-icon v-if="Number(task.status_id) === 0" class="done-floating" name="done" />
      </q-item>
    </template>

    <q-separator v-if="tasksWithTime.length > 0 && tasksWithoutTime.length > 0" class="q-my-md" />

    <template v-if="tasksWithoutTime.length > 0">
      <q-item
        v-for="task in tasksWithoutTime"
        :key="task.id"
        class="q-pa-md task-card"
        :class="{
          'bg-grey-2': Number(task.status_id) === 0,
          'selected-task': selectedTaskId === task.id,
        }"
        :active="selectedTaskId === task.id"
        clickable
        @pointerdown="() => startLongPress(task)"
        @pointerup="cancelLongPress"
        @pointercancel="cancelLongPress"
        @pointerleave="cancelLongPress"
        @click="handleTaskClick(task)"
      >
        <q-item-section class="title-row">
          <div style="flex: 1 1 auto">
            <q-item-label :class="{ 'text-strike': Number(task.status_id) === 0 }"
              ><span
                class="priority-left"
                :title="task.priority"
                :style="{
                  backgroundColor: priorityColor(task.priority),
                  color: priorityTextColor(task.priority),
                }"
              >
                <q-icon
                  :name="themePriorityDefinitions[task.priority]?.icon || 'label'"
                  size="14px"
                /> </span
              ><strong>{{ task.name }}</strong></q-item-label
            >
            <q-item-label v-if="getDisplayDescription(task)" caption>{{
              getDisplayDescription(task)
            }}</q-item-label>
          </div>
        </q-item-section>
        <q-item-section side>
          <div class="task-controls-grid">
            <div>
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                @click.stop="openDeleteMenu = openDeleteMenu === task.id ? null : task.id"
              />
              <div v-if="openDeleteMenu === task.id" class="row items-center" style="gap: 8px">
                <div>Delete?</div>
                <q-btn
                  flat
                  dense
                  color="negative"
                  label="Yes"
                  @click.stop="confirmDelete(task.id)"
                />
                <q-btn flat dense label="No" @click.stop="openDeleteMenu = null" />
              </div>
            </div>
            <div>
              <q-btn flat round dense icon="edit" color="primary" @click.stop="editTask(task)" />
            </div>

            <div>
              <q-checkbox
                :model-value="Number(task.status_id) === 0"
                @click.stop="toggleStatus(task)"
              />
            </div>
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
} from './theme';

const { groups } = useDayOrganiser();

setLongPressHandler((t: any) => {
  emit('edit-task', t);
});

const priorityColor = (priority: any) => themePriorityColors[priority] || 'transparent';
const priorityTextColor = (priority: any) => themePriorityTextColor(priority);

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
  return formatEventHoursDiff(dateStr, timeStr);
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
  gap: 12px;
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
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 18px;
  font-size: 12px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  margin-right: 6px;
  flex: 0 0 auto;
  font-size: 12px;
}
/* title row ensuring badge sits left of title */
.title-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px;
  flex-direction: row !important;
}
.title-row > div {
  min-width: 0; /* allow text to truncate instead of pushing badge above */
  display: flex;
  flex-direction: column;
}
.title-row q-item-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.priority-left {
  vertical-align: middle;
}
/* 2x2 grid for controls: edit / delete / priority+group / done checkbox */
.task-controls-grid {
  display: grid;
  grid-template-columns: 32px 32px;
  grid-template-rows: auto auto;
  gap: 6px;
  align-items: center;
  justify-items: center;
}
.task-controls-grid > div {
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Slightly smaller text for task cards to match compact notification style */
.task-card {
  font-size: 13px;
}
.task-card strong {
  font-size: 14px;
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
  border: 2px solid var(--q-primary, #1976d2);
  border-radius: 6px;
  background-color: rgba(25, 118, 210, 0.06);
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.06);
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
