<template>
  <div class="task-list">
    <template v-if="mergedTasks.length > 0">
      <template v-for="item in mergedTasks" :key="item.id">
        <template v-if="item.__isReplenish">
          <ReplenishmentList
            :replenish-tasks="item._items"
            :size="'small'"
            @toggle-status="$emit('toggle-status', $event)"
            @edit-task="$emit('edit-task', $event)"
          />
        </template>

        <HiddenGroupItem
          v-else-if="item.__isHiddenGroup"
          :group="item._group"
          @select="selectHiddenGroup"
        />

        <TaskCardSmall
          v-else
          :item="item"
          :selected-task-id="selectedTaskId"
          @task-click="$emit('task-click', $event)"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ReplenishmentList from "./ReplenishmentList.vue";
import HiddenGroupItem from "./HiddenGroupItem.vue";
import TaskCardSmall from "./TaskCardSmall.vue";
import * as api from "src/modules/day-organiser/_apiRoot";

const props = defineProps<{
  tasksWithTime: any[];
  tasksWithoutTime: any[];
  selectedTaskId: string | null;
  hiddenGroups?: any[];
  replenishTasks?: any[];
}>();

const emit = defineEmits<{
  (e: "toggle-status", task: any): void;
  (e: "edit-task", task: any): void;
  (e: "task-click", task: any): void;
  (e: "delete-task", id: string): void;
}>();

const groups = api.group.list.all;
const activeGroup = api.group.active.activeGroup;

const mergedTasks = computed(() => {
  const out: any[] = [];
  if (props.hiddenGroups && props.hiddenGroups.length > 0) {
    props.hiddenGroups.forEach((g: any) => {
      out.push({ __isHiddenGroup: true, id: `hg-${g.id}`, _group: g });
    });
  }
  if (props.replenishTasks && props.replenishTasks.length > 0) {
    out.push({ __isReplenish: true, id: "replenish-card", _items: props.replenishTasks });
  }

  const activeId =
    activeGroup?.value?.value == null ? null : String(activeGroup.value.value);

  const filterTask = (t: any) => {
    if (!t) return false;
    try {
      const taskGroupId = t.groupId ?? t.group_id ?? null;
      if (!taskGroupId) return true;
      try {
        return api.group.list.isVisibleForActive(taskGroupId);
      } catch (e) {
        if (!activeId) return true;
        return true;
      }
    } catch (e) {
      return true;
    }
  };

  out.push(...(props.tasksWithTime || []).filter(filterTask));
  out.push(...(props.tasksWithoutTime || []).filter(filterTask));
  return out;
});

function selectHiddenGroup(g: any) {
  if (!g) return;
  try {
    activeGroup.value = { label: g.name || String(g.id), value: g.id };
  } catch (e) {
    void e;
  }
}
</script>

<style scoped>
.task-list {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important;
  gap: 8px 8px !important; /* row-gap 8px, column-gap 2px */
  align-items: start;
  padding: 0 8px 8px 8px;
  box-sizing: border-box;
  padding-bottom: 15px;
}
</style>
