<template>
  <div class="task-list">
    <template v-if="mergedTasks.length > 0">
      <template v-for="(item, index) in mergedTasks" :key="item.id">
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

        <template v-else-if="item.__isGroup">
          <q-card
            flat
            class="q-pa-sm"
            :style="getGroupContainerStyle(item._items.length)"
          >
            <div class="row items-center" style="gap: 8px">
              <q-avatar
                size="36"
                :style="{
                  background: item._group?.color || getGroupColor(item._group?.id),
                }"
              >
                <q-icon
                  :name="item._group?.icon || getGroupIcon(item._group?.id) || 'group'"
                  color="white"
                  size="18"
                />
              </q-avatar>
              <div class="title-main">
                <div class="title-text">
                  <q-item-label class="title-ellipsis"
                    ><strong>{{ item._group?.name || "Ungrouped" }}</strong></q-item-label
                  >
                </div>
              </div>
            </div>
            <div style="margin-top: 8px; display: grid; gap: 8px">
              <TaskCardSmall
                v-for="t in item._items"
                :key="t.id"
                :item="t"
                :selected-task-id="selectedTaskId"
                @task-click="(tItem, rect) => $emit('task-click', tItem, rect)"
              />
            </div>
          </q-card>
        </template>

        <template v-else>
          <div class="grouped-item card" :style="{ position: 'relative' }">
            <div v-if="isNewGroup(index, item)" class="group-label">
              {{ getGroupName(item.groupId || item.group_id) }}
            </div>
            <div
              v-if="isNewGroup(index, item)"
              class="group-divider"
              aria-hidden="true"
            ></div>
            <TaskCardSmall
              :item="item"
              :selected-task-id="selectedTaskId"
              @task-click="(tItem, rect) => $emit('task-click', tItem, rect)"
            />
          </div>
        </template>
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
  (e: "task-click", task: any, rect?: DOMRect | null): void;
  (e: "delete-task", id: string): void;
}>();

const groups = api.group.list.all;
const activeGroup = api.group.active.activeGroup;

function getGroupName(groupId: any) {
  if (!groupId) return "";
  const g = groups.value.find((x: any) => String(x.id) === String(groupId));
  return g ? g.name : "";
}

function getGroupColor(groupId: any) {
  if (!groupId) return "#1976d2";
  const g = groups.value.find((x: any) => String(x.id) === String(groupId));
  return g?.color || "#1976d2";
}

function getGroupIcon(groupId: any) {
  if (!groupId) return null;
  const g = groups.value.find((x: any) => String(x.id) === String(groupId));
  return g?.icon || null;
}

const mergedTasks = computed(() => {
  const out: any[] = [];
  // preserve hidden groups sentinel
  if (props.hiddenGroups && props.hiddenGroups.length > 0) {
    props.hiddenGroups.forEach((g: any) => {
      out.push({ __isHiddenGroup: true, id: `hg-${g.id}`, _group: g });
    });
  }
  // preserve replenish sentinel
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

  // collect tasks
  const tasks: any[] = [];
  tasks.push(...(props.tasksWithTime || []).filter(filterTask));
  tasks.push(...(props.tasksWithoutTime || []).filter(filterTask));

  if (tasks.length === 0) return out;

  // sort tasks by group ancestry path then by name (re-use replenish logic)
  const getGroupPath = (groupId: any) => {
    if (!groupId) return [] as string[];
    const path: string[] = [];
    let cur = groups.value.find((g: any) => String(g.id) === String(groupId));
    while (cur) {
      path.push(cur.name || String(cur.id));
      const pid = cur.parentId ?? cur.parent_id ?? null;
      if (pid == null) break;
      cur = groups.value.find((g: any) => String(g.id) === String(pid));
    }
    return path.reverse();
  };

  tasks.sort((a: any, b: any) => {
    const pa = getGroupPath(a.groupId ?? a.group_id);
    const pb = getGroupPath(b.groupId ?? b.group_id);
    const max = Math.max(pa.length, pb.length);
    for (let i = 0; i < max; i++) {
      if (i >= pa.length) return -1;
      if (i >= pb.length) return 1;
      const na = (pa[i] || "").toLowerCase();
      const nb = (pb[i] || "").toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
    }
    const na = (a.name || "").toLowerCase();
    const nb = (b.name || "").toLowerCase();
    if (na < nb) return -1;
    if (na > nb) return 1;
    return 0;
  });

  // flatten sorted tasks into output and attach resolved group reference for label rendering
  for (const t of tasks) {
    const gid = t.groupId ?? t.group_id ?? "__ungrouped__";
    const grpObj =
      gid === "__ungrouped__"
        ? null
        : groups.value.find((g: any) => String(g.id) === String(gid));
    // attach _group for use in template label resolution
    out.push({ ...t, _group: grpObj });
  }

  return out;
});

// helper to detect start of a new group in the rendered flat list
function isNewGroup(idx: number, task: any) {
  try {
    if (idx === 0) return true;
    const prev = mergedTasks.value[idx - 1];
    const curId = String(task.groupId ?? task.group_id ?? "__ungrouped__");
    const prevId = String(
      prev.groupId ?? prev.group_id ?? (prev._group ? prev._group.id : "__ungrouped__")
    );
    return curId !== prevId;
  } catch (e) {
    return true;
  }
}
function getGroupContainerStyle(n: number) {
  const span = Math.max(1, Math.ceil(n / 3));
  return { gridColumn: `span ${span}` };
}

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
  gap: 8px 10px !important; /* row-gap 8px, column-gap 2px */
  align-items: start;
  padding: 0 8px 8px 8px;
  box-sizing: border-box;
  padding-bottom: 15px;
}

/* Group label/divider styles copied from ReplenishmentList for inline grouping */
.grouped-item {
  position: relative;
}
.group-label {
  position: absolute;
  top: -7px;
  left: 8px;
  font-size: 11px;
  line-height: 1;
  color: rgba(0, 0, 0, 0.6);
  background: rgba(255, 255, 255, 0.85);
  padding: 0 6px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.02) inset;
  pointer-events: none;
  z-index: 1;
}
.group-divider {
  position: absolute;
  top: -6px;
  left: -8px;
  right: -8px;
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  pointer-events: none;
}
</style>
