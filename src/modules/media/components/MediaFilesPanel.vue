<template>
  <q-card-section class="media-files-panel">
    <div v-if="!sortedMediaTasks.length" class="media-files-panel__placeholder">
      <q-icon name="folder_shared" size="48px" color="grey-6" />
      <div class="text-subtitle1 text-weight-medium q-mt-sm">
        {{ $text('files.panel_title') }}
      </div>
      <div class="text-caption text-grey-7 q-mt-xs">
        {{ $text('files.panel_placeholder') }}
      </div>
    </div>

    <div v-else class="tasks-list-wrapper">
      <div class="task-list" :class="`task-list--${listSizeVariant}`">
        <TaskCardSmall
          v-for="task in sortedMediaTasks"
          :key="task.id"
          :item="task"
          :selected-task-id="selectedTaskId ?? null"
          :active-group-id="activeGroupId ?? null"
          :size-variant="listSizeVariant"
          @task-click="(t, rect) => emit('task-click', t, rect)"
          @task-context="(t, rect) => emit('task-context', t, rect)"
        />
      </div>
    </div>
  </q-card-section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import type { Task } from 'src/modules/task/models/TaskModel';
import { isMediaTaskTypeId } from 'src/modules/media/mediaTaskTypes';
import { resolveTaskListSizeVariant } from 'src/components/theme';
import TaskCardSmall from 'src/modules/task/components/element/TaskCardSmall.vue';

const props = defineProps<{
  tasks: Task[];
  activeGroupId?: string | null;
  selectedTaskId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task, rect?: DOMRect | null): void;
  (e: 'task-context', task: Task, rect?: DOMRect | null): void;
}>();

const sortedMediaTasks = computed(() => {
  let list = (props.tasks || []).filter((t) =>
    isMediaTaskTypeId(String(t.type_id || '')),
  );
  const gid = props.activeGroupId;
  if (gid != null && gid !== '') {
    list = list.filter((t) => String(t.groupId ?? '') === String(gid));
  }
  return list.slice().sort((a, b) => {
    const na = String(a.name || '').toLowerCase();
    const nb = String(b.name || '').toLowerCase();
    return na.localeCompare(nb);
  });
});

const listSizeVariant = computed(() =>
  resolveTaskListSizeVariant(sortedMediaTasks.value.length),
);
</script>

<style scoped>
.media-files-panel {
  min-height: 240px;
  padding: 0;
}

.media-files-panel__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  text-align: center;
  padding: 24px 16px;
}

.tasks-list-wrapper {
  position: relative;
  width: 100%;
  min-width: 0;
}

.task-list {
  width: 100%;
  min-width: 0;
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important;
  gap: 8px 10px !important;
  align-items: start;
  padding: 0 16px 8px 16px;
  box-sizing: border-box;
  padding-bottom: 15px;
}
</style>
