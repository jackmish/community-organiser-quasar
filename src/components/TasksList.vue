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
        :active="selectedTaskId === task.id"
        clickable
        @pointerdown="() => startLongPress(task)"
        @pointerup="cancelLongPress"
        @pointercancel="cancelLongPress"
        @pointerleave="cancelLongPress"
        @click="handleTaskClick(task)"
      >
        <q-item-section side style="min-width: 60px">
          <div class="text-bold text-primary">{{ task.eventTime }}</div>
          <div v-if="getEventHoursDisplay(task)" class="text-caption text-grey-7 q-mt-xs">
            {{ getEventHoursDisplay(task) }}
          </div>
        </q-item-section>
        <q-item-section side>
          <q-checkbox
            :model-value="Number(task.status_id) === 0"
            @click.stop="toggleStatus(task)"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label :class="{ 'text-strike': Number(task.status_id) === 0 }">
            <strong>{{ task.name }}</strong>
          </q-item-label>
          <q-item-label v-if="getDisplayDescription(task)" caption>
            {{ getDisplayDescription(task) }}
          </q-item-label>
          <q-item-label caption class="q-mt-xs">
            <q-chip
              size="sm"
              :style="{
                backgroundColor: priorityColor(task.priority),
                color: priorityTextColor(task.priority),
              }"
            >
              {{ task.priority }}
            </q-chip>
            <q-chip
              v-if="task.groupId"
              :style="{ backgroundColor: getGroupColor(task.groupId) }"
              text-color="white"
              size="sm"
              icon="folder"
            >
              {{ getGroupName(task.groupId) }}
            </q-chip>
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row items-center" style="gap: 8px">
            <q-btn flat round dense icon="edit" color="primary" @click.stop="editTask(task)" />
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
              <q-btn flat dense color="negative" label="Yes" @click.stop="confirmDelete(task.id)" />
              <q-btn flat dense label="No" @click.stop="openDeleteMenu = null" />
            </div>
          </div>
        </q-item-section>

        <q-icon v-if="Number(task.status_id) === 0" class="done-floating" name="done" />
        <q-icon v-if="Number(task.status_id) === 0" class="done-floating" name="done" />
      </q-item>
    </template>

    <q-separator v-if="tasksWithTime.length > 0 && tasksWithoutTime.length > 0" class="q-my-md" />
    <q-item-label
      v-if="tasksWithTime.length > 0 && tasksWithoutTime.length > 0"
      header
      class="text-grey-7"
      >No Time Set</q-item-label
    >

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
        <q-item-section>
          <q-item-label :class="{ 'text-strike': Number(task.status_id) === 0 }"
            ><strong>{{ task.name }}</strong></q-item-label
          >
          <q-item-label v-if="getDisplayDescription(task)" caption>{{
            getDisplayDescription(task)
          }}</q-item-label>
          <q-item-label caption class="q-mt-xs">
            <q-chip
              size="sm"
              :style="{
                backgroundColor: priorityColor(task.priority),
                color: priorityTextColor(task.priority),
              }"
              >{{ task.priority }}</q-chip
            >
            <q-chip
              v-if="task.groupId"
              :style="{ backgroundColor: getGroupColor(task.groupId) }"
              text-color="white"
              size="sm"
              icon="folder"
              >{{ getGroupName(task.groupId) }}</q-chip
            >
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row items-center" style="gap: 8px">
            <q-btn
              flat
              round
              dense
              icon="edit"
              color="primary"
              @click.stop="() => editTask(task)"
            />
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
              <q-btn flat dense color="negative" label="Yes" @click.stop="confirmDelete(task.id)" />
              <q-btn flat dense label="No" @click.stop="openDeleteMenu = null" />
            </div>
          </div>
          <div class="row">
            <q-item-section side>
              <q-checkbox
                :model-value="Number(task.status_id) === 0"
                @click.stop="toggleStatus(task)"
              />
            </q-item-section>
          </div>
        </q-item-section>
      </q-item>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  tasksWithTime: any[];
  tasksWithoutTime: any[];
  selectedTaskId: string | null;
  startLongPress: (task: any) => void;
  cancelLongPress: () => void;
  handleTaskClick: (task: any) => void;
  toggleStatus: (task: any) => void;
  editTask: (task: any) => void;
  handleDeleteTask: (id: string) => void;
  getEventHoursDisplay: (task: any) => string | undefined;
  getDisplayDescription: (task: any) => string | undefined;
  priorityColor: (p: any) => string | undefined;
  priorityTextColor: (p: any) => string | undefined;
  getGroupColor: (id?: string) => string | undefined;
  getGroupName: (id?: string) => string | undefined;
}>();

const openDeleteMenu = ref<string | null>(null);

function confirmDelete(id: string) {
  openDeleteMenu.value = null;
  props.handleDeleteTask(id);
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
