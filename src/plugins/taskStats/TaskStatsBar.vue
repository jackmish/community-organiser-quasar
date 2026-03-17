<template>
  <div class="task-stats-bar row items-center q-px-sm q-py-xs" style="gap: 12px">
    <strong>Experimental plugin, API test.</strong>
    <span class="text-caption text-grey-6">
      {{ groupLabel }}
    </span>
    <div class="row items-center" style="gap: 10px; margin-left: auto">
      <div class="stat-chip stat-chip--total">
        <q-icon name="list" size="12px" />
        {{ stats.total }}
      </div>
      <div class="stat-chip stat-chip--done">
        <q-icon name="check_circle" size="12px" />
        {{ stats.done }}
      </div>
      <div class="stat-chip stat-chip--undone">
        <q-icon name="radio_button_unchecked" size="12px" />
        {{ stats.undone }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import * as api from "src/controllerRoot";

const stats = computed(
  () => api.task.taskStats ?? { total: 0, done: 0, undone: 0, groupId: null }
);

const groupLabel = computed(() => {
  const id = stats.value.groupId;
  if (!id) return "All groups";
  const found = api.group.list.all.value?.find((g: any) => g.id === id);
  return found?.name ?? id;
});
</script>

<style scoped>
.task-stats-bar {
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0 0 8px 8px;
  background: rgba(21, 101, 192, 0.8);
}

.task-stats-bar .text-grey-6 {
  color: rgba(255, 255, 255, 0.85) !important;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  color: #fff;
}

.stat-chip--total {
  background: rgba(255, 255, 255, 0.15);
}

.stat-chip--done {
  background: rgba(76, 200, 80, 0.35);
}

.stat-chip--undone {
  background: rgba(255, 255, 255, 0.1);
}
</style>
