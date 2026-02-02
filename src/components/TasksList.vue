<template>
  <div
    class="task-list"
    style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 8px;
      align-items: start;
    "
  >
    <template v-if="mergedTasks.length > 0">
      <template v-for="item in mergedTasks" :key="item.id">
        <template v-if="item.__isReplenish">
          <q-card-section>
            <ReplenishmentList
              :replenish-tasks="item._items"
              @toggle-status="$emit('toggle-status', $event)"
              @edit-task="$emit('edit-task', $event)"
            />
          </q-card-section>
        </template>
        <template v-else-if="item.__isHiddenGroup">
          <q-item
            class="q-pa-sm task-card hidden-group-item"
            clickable
            @click.stop="selectHiddenGroup(item._group)"
          >
            <q-item-section>
              <div style="display: flex; align-items: center; gap: 8px; flex: 1 1 auto">
                <q-avatar
                  size="40"
                  :style="{ background: item._group.color || getGroupColor(item._group.id) }"
                >
                  <q-icon
                    :name="item._group.icon || getGroupIcon(item._group.id) || 'group'"
                    size="18"
                    color="white"
                  />
                </q-avatar>
                <div class="title-main">
                  <div class="title-text">
                    <q-item-label class="title-ellipsis"
                      ><strong>{{ item._group.name }}</strong></q-item-label
                    >
                    <div class="text-caption">{{ item._group.total }} tasks</div>
                  </div>
                </div>
              </div>
            </q-item-section>
            <q-item-section side>
              <div class="priority-summary-grid">
                <span
                  v-if="item._group.critical > 0"
                  class="priority-summary"
                  :style="{ background: '#b71c1c', color: 'white' }"
                >
                  <q-icon name="warning" size="14px" /> {{ item._group.critical }}
                </span>
                <span
                  v-if="item._group.high > 0"
                  class="priority-summary"
                  :style="{
                    background: themePriorityColors.high,
                    color: themePriorityTextColor('high'),
                  }"
                >
                  <q-icon
                    :name="themePriorityDefinitions['high']?.icon || 'priority_high'"
                    size="14px"
                  />
                  {{ item._group.high }}
                </span>
                <span
                  v-if="item._group.medium > 0"
                  class="priority-summary"
                  :style="{
                    background: themePriorityColors.medium,
                    color: themePriorityTextColor('medium'),
                  }"
                >
                  <q-icon :name="themePriorityDefinitions['medium']?.icon || 'label'" size="14px" />
                  {{ item._group.medium }}
                </span>
                <span
                  v-if="item._group.low > 0"
                  class="priority-summary"
                  :style="{
                    background: themePriorityColors.low,
                    color: themePriorityTextColor('low'),
                  }"
                >
                  <q-icon
                    :name="themePriorityDefinitions['low']?.icon || 'label_outline'"
                    size="14px"
                  />
                  {{ item._group.low }}
                </span>
              </div>
            </q-item-section>
          </q-item>
        </template>

        <q-item
          v-else
          class="q-pa-sm task-card"
          :class="{
            'bg-grey-2': Number(item.status_id) === 0,
            'selected-task': selectedTaskId === item.id,
          }"
          :style="itemStyle(item)"
          :active="selectedTaskId === item.id"
          clickable
          @pointerdown="() => startLongPress(item)"
          @pointerup="cancelLongPress"
          @pointercancel="cancelLongPress"
          @pointerleave="cancelLongPress"
          @click="handleTaskClick(item)"
        >
          <q-icon
            v-if="typeIcons[item.type_id || item.type]"
            :name="typeIcons[item.type_id || item.type]"
            class="type-watermark"
          />
          <q-item-section class="title-row">
            <div style="flex: 1 1 auto">
              <div class="title-main">
                <div class="title-text">
                  <q-item-label
                    :class="[
                      {
                        'text-strike': Number(item.status_id) === 0 && item.timeMode !== 'prepare',
                      },
                      'title-ellipsis',
                    ]"
                  >
                    <strong>
                      <span v-if="countTodoSubtasks(item).total > 0">
                        ({{ countTodoSubtasks(item).done }}/{{
                          countTodoSubtasks(item).total
                        }})&nbsp;
                      </span>
                      {{ getDisplayName(item) }}
                      <span class="star-count" v-if="countStarredUndone(item) > 0">
                        <q-icon
                          v-for="n in countStarredUndone(item)"
                          :key="`s-${item.id}-${n}`"
                          :name="highlightIcon"
                          color="amber"
                          size="14px"
                        />
                      </span>
                    </strong>
                  </q-item-label>
                </div>
                <div class="title-checkbox">
                  <q-checkbox
                    class="task-checkbox"
                    :model-value="Number(item.status_id) === 0"
                    @click.stop="toggleStatus(item)"
                  />
                </div>
              </div>
              <q-item-label
                v-if="
                  !isTodoType(item) &&
                  (item.type === 'event' ||
                    item.type_id === 'TimeEvent' ||
                    item.type === 'TimeEvent' ||
                    item.timeMode === 'event') &&
                  getEventHoursDisplay(item)
                "
                caption
                :class="[
                  'task-desc',
                  {
                    'has-date': hasDate(item),
                    'prepare-desc': item.timeMode === 'prepare',
                    'expiration-desc': item.timeMode === 'expiration',
                  },
                ]"
              >
                <span
                  class="priority-inline"
                  :title="item.priority"
                  :style="{
                    backgroundColor: priorityColor(item.priority),
                    color: priorityTextColor(item.priority),
                  }"
                >
                  <q-icon
                    :name="themePriorityDefinitions[item.priority]?.icon || 'label'"
                    size="12px"
                  />
                </span>
                {{ getEventHoursDisplay(item) }}
              </q-item-label>
              <q-item-label v-else-if="getDisplayDescription(item)" caption class="task-desc">
                <span
                  class="priority-inline"
                  :title="item.priority"
                  :style="{
                    backgroundColor: priorityColor(item.priority),
                    color: priorityTextColor(item.priority),
                  }"
                >
                  <q-icon
                    :name="themePriorityDefinitions[item.priority]?.icon || 'label'"
                    size="12px"
                  />
                </span>
                {{ getDisplayDescription(item) }}
              </q-item-label>
            </div>
          </q-item-section>
          <q-item-section side>
            <div class="task-controls-grid">
              <div class="controls-edit">
                <q-btn flat round dense icon="edit" class="edit-btn" @click.stop="editTask(item)" />
              </div>

              <div class="controls-menu">
                <q-btn
                  flat
                  round
                  dense
                  icon="more_vert"
                  class="menu-btn"
                  @click.stop="openItemMenuId = item.id"
                />
                <q-menu
                  class="use-default"
                  :model-value="openItemMenuId === item.id"
                  @update:model-value="(val) => onItemMenuToggle(val, item.id)"
                  anchor="top right"
                  self="top right"
                >
                  <q-list padding>
                    <q-item
                      clickable
                      v-ripple
                      @click.stop="
                        () => {
                          editTask(item);
                          openItemMenuId = null;
                        }
                      "
                      style="
                        background: rgba(255, 152, 0, 1) !important;
                        color: rgba(0, 0, 0, 0.95) !important;
                      "
                    >
                      <q-item-section avatar style="min-width: 36px">
                        <q-icon name="edit" color="#ff9800" />
                      </q-item-section>
                      <q-item-section style="color: rgba(0, 0, 0, 0.95) !important"
                        >Edit</q-item-section
                      >
                    </q-item>
                    <template v-if="pendingDeleteId !== item.id">
                      <q-item
                        clickable
                        v-ripple
                        @click.stop="
                          () => {
                            requestDelete(item.id);
                          }
                        "
                        style="background: #b71c1c !important; color: #ffffff !important"
                      >
                        <q-item-section avatar style="min-width: 36px">
                          <q-icon name="delete" color="#ffffff" />
                        </q-item-section>
                        <q-item-section style="color: #ffffff !important">Delete</q-item-section>
                      </q-item>
                    </template>
                    <template v-else>
                      <q-item>
                        <q-item-section>
                          <div style="display: flex; align-items: center; gap: 8px">
                            <div style="flex: 1; font-weight: 600; color: rgba(0, 0, 0, 0.95)">
                              Confirm delete?
                            </div>
                            <div style="display: flex; gap: 6px">
                              <q-btn
                                dense
                                flat
                                color="negative"
                                label="Delete"
                                @click.stop="() => performDelete(item.id)"
                              />
                              <q-btn dense flat label="Cancel" @click.stop="cancelDelete" />
                            </div>
                          </div>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-list>
                </q-menu>
              </div>

              <div class="group-name">{{ getGroupName(item.groupId || item.group_id) }}</div>
            </div>
          </q-item-section>
        </q-item>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

import { useLongPress } from '../composables/useLongPress';
import ReplenishmentList from './ReplenishmentList.vue';

const props = defineProps<{
  tasksWithTime: any[];
  tasksWithoutTime: any[];
  selectedTaskId: string | null;
  hiddenGroups?: any[];
  replenishTasks?: any[];
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
const { groups, activeGroup } = useDayOrganiser();
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  priorityDefinitions as themePriorityDefinitions,
  formatEventHoursDiff,
  formatDisplayDate,
  typeIcons,
  highlightIcon,
} from './theme';

const openItemMenuId = ref<string | null>(null);
const pendingDeleteId = ref<string | null>(null);

function onItemMenuToggle(val: boolean, id: string) {
  if (val) openItemMenuId.value = id;
  else if (openItemMenuId.value === id) openItemMenuId.value = null;
}

function requestDelete(id: string) {
  pendingDeleteId.value = id;
}

function performDelete(id: string) {
  pendingDeleteId.value = null;
  openItemMenuId.value = null;
  emit('delete-task', id);
}

function cancelDelete() {
  pendingDeleteId.value = null;
}
const mergedTasks = computed(() => {
  const out: any[] = [];
  if (props.hiddenGroups && props.hiddenGroups.length > 0) {
    props.hiddenGroups.forEach((g: any) => {
      out.push({ __isHiddenGroup: true, id: `hg-${g.id}`, _group: g });
    });
  }
  // Replenishment floating card: insert as a full-width sentinel before tasks
  if (props.replenishTasks && props.replenishTasks.length > 0) {
    out.push({ __isReplenish: true, id: 'replenish-card', _items: props.replenishTasks });
  }
  // If an active group is selected and it's a child, exclude tasks that belong
  // to any ancestor (parent) groups so parent tasks don't appear inside child view.
  const activeId = activeGroup?.value?.value == null ? null : String(activeGroup.value.value);

  const isAncestor = (ancestorId: any, childId: any) => {
    if (!ancestorId || !childId) return false;
    let cur = groups.value.find((g: any) => String(g.id) === String(childId));
    while (cur) {
      const pid = cur.parentId ?? cur.parent_id ?? null;
      if (pid == null) return false;
      if (String(pid) === String(ancestorId)) return true;
      cur = groups.value.find((g: any) => String(g.id) === String(pid));
    }
    return false;
  };

  const filterTask = (t: any) => {
    if (!t) return false;
    if (!activeId) return true;
    // if active is a child of someone, we don't want tasks from its ancestors
    // so exclude tasks whose groupId is an ancestor of the active group
    try {
      const taskGroupId = t.groupId ?? t.group_id ?? null;
      if (!taskGroupId) return true;
      // Only include tasks that belong to the active group itself or its descendants.
      // Exclude tasks from ancestor groups and sibling groups.
      const taskG = String(taskGroupId);
      const activeG = String(activeId);
      if (taskG === activeG) return true;
      // if the task's group is a descendant of the active group, include it
      if (isAncestor(activeG, taskG)) return true;
      // otherwise exclude (ancestors, siblings, or unrelated groups)
      return false;
    } catch (e) {
      // fall through
    }
    return true;
  };

  out.push(...(props.tasksWithTime || []).filter(filterTask));
  out.push(...(props.tasksWithoutTime || []).filter(filterTask));
  return out;
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

const getGroupIcon = (groupId?: string) => {
  if (!groupId) return null;
  const g = groups.value.find((gg: any) => gg.id === groupId);
  return g?.icon || null;
};

function selectHiddenGroup(g: any) {
  if (!g) return;
  try {
    activeGroup.value = { label: g.name || String(g.id), value: g.id };
  } catch (e) {
    // ignore
  }
}

// parent navigation handled elsewhere in the UI

const isTodoType = (task: any) => {
  const t = String(task?.type || task?.type_id || '').toLowerCase();
  return t.includes('todo');
};

const getEventHoursDisplay = (task: any) => {
  const dateStr = task?.date || task?.eventDate || '';
  const timeStr = task?.eventTime || '';
  if (!dateStr) return '';

  const formatShortDate = (s: string) => {
    const d = parseYmdLocal(s) || new Date(s);
    if (!d || isNaN(d.getTime())) return formatDisplayDate(s);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  };

  // If task is a prepare/expiration reminder, show remaining days to the event
  try {
    const mode = task?.timeMode || (task && (task.timeOffsetDays ? 'prepare' : 'event')) || 'event';
    if (mode === 'prepare' || mode === 'expiration') {
      const evD = parseYmdLocal(dateStr);
      const today = new Date();
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (evD) {
        const evMid = new Date(evD.getFullYear(), evD.getMonth(), evD.getDate());
        const diffDays = Math.round((evMid.getTime() - todayMid.getTime()) / 86400000);
        let rel = '';
        if (diffDays === 0) rel = 'Today';
        else if (diffDays === 1) rel = 'Tomorrow';
        else if (diffDays > 1) rel = `In ${diffDays}days`;
        else rel = `${Math.abs(diffDays)} days ago`;

        const shortDate = formatShortDate(dateStr);
        if (timeStr) {
          // Prefer two-line format when both relative and exact time are present
          return `${rel}\n${shortDate} | ${timeStr}`;
        }
        return `${rel}, ${shortDate}`;
      }
    }
  } catch (e) {
    // fall back to existing behavior
  }

  // Event mode: if explicit time present, show date + time; otherwise use relative/single-line
  if (timeStr) {
    // Prefer a relative label for dates that are near (Today/Tomorrow/weekday)
    try {
      const evD = parseYmdLocal(dateStr);
      if (evD) {
        const today = new Date();
        const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const evMid = new Date(evD.getFullYear(), evD.getMonth(), evD.getDate());
        const diffDays = Math.round((evMid.getTime() - todayMid.getTime()) / 86400000);
        if (diffDays === 0) return `Today | ${timeStr}`;
        if (diffDays === 1) return `Tomorrow | ${timeStr}`;
        if (diffDays > 1 && diffDays <= 6)
          return `${evD.toLocaleDateString(undefined, { weekday: 'long' })} | ${timeStr}`;
      }
    } catch (e) {
      // fall back to short date formatting
    }
    const shortDate = formatShortDate(dateStr);
    return `${shortDate} | ${timeStr}`;
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

// Local YYYY-MM-DD parser to avoid timezone shifts
const parseYmdLocal = (s: string | undefined | null): Date | null => {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-');
  if (parts.length < 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
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

import { countTodoSubtasks, countStarredUndone } from 'src/utils/todo';

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

// (no local aliases needed; imported theme helpers are used)

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
  display: grid !important;
  /* use auto-fit with a sensible min width so grid creates as many columns as fit
     across different screen sizes (robust against container width constraints) */
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important;
  gap: 8px;
  align-items: start;
  padding: 0 8px 8px 8px; /* remove top padding, keep other sides */
  box-sizing: border-box;
}
.task-card {
  width: 100%;
  /* ensure parent/global styles don't force a large min-width */
  min-width: 0 !important;
  max-width: none !important;
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

.star-count q-icon {
  margin-left: 4px;
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
  font-size: 15px; /* larger hour/time for time-event tasks */
  line-height: 1.1;
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
  /* margin-right: 6px;  */
  font-size: 12px;
  i {
    position: relative;
    top: 2px;
  }
}

.type-watermark {
  position: absolute;
  left: 50%;
  top: 50%;
  /* center and sit a bit lower inside the card */
  transform: translate(-50%, -35%) rotate(-10deg);
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
/* clamp the title to a maximum of 2 lines and show ellipsis */
.title-text q-item-label {
  padding: 0;
  margin: 0;
  font-size: 13px;
  line-height: 1.1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal; /* allow wrapping up to the clamp */
}
.title-text q-item-label strong {
  font-size: 13px;
  font-weight: 600;
}
/* tighten title spacing */
.title-text q-item-label,
.title-text q-item-label strong {
  line-height: 1.05;
}
.title-row q-item-label {
  /* allow wrapping but clamp to two lines to avoid 3-line titles
     use !important to override other global/compiled rules */
  white-space: normal !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  display: -webkit-box !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
}
.task-desc {
  display: -webkit-box !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 1 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  line-height: 1.3 !important;
  margin: 0 !important;
  max-width: 100%;
  max-height: calc(1 * 1.3em + 8px) !important; /* extra buffer to avoid clipping */
  padding-top: 0 !important; /* reset top padding per request */

  color: inherit; /* respect item text color */
}

.prepare-desc {
  font-size: 11px !important;
  line-height: 1.2 !important;
}
.expiration-desc {
  font-size: 11px !important;
  line-height: 1.2 !important;
}
/* Make task list checkboxes larger (30x30 inner box) */
.task-checkbox {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 30px !important;
  height: 30px !important;
  min-width: 30px !important;
  min-height: 30px !important;
  padding: 0 !important;
  margin: 0 !important;
}
.task-checkbox .q-checkbox__inner {
  width: 18px !important;
  height: 18px !important;
  min-width: 18px !important;
  min-height: 18px !important;
}
.task-checkbox .q-icon {
  font-size: 14px !important;
}
/* ensure truncation applies in title rows */
.title-row .task-desc {
  max-width: calc(100%);
}
.priority-left {
  vertical-align: middle;
}
/* 2x2 grid for controls: edit / delete / priority+group / done checkbox */
.task-controls-grid {
  top: 3px !important;
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
/* place menu button in top-right cell */
.task-controls-grid .controls-menu {
  grid-column: 2;
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
/* ensure menu (more) icon matches edit icon color */
.menu-btn .q-icon {
  color: rgba(0, 0, 0, 0.9) !important;
}
.menu-btn {
  color: rgba(0, 0, 0, 0.9) !important;
}
/* menu button should match edit button color */
/* menu button uses default icon color (inherit) */
/* Slightly smaller text for task cards to match compact notification style */
.task-card {
  font-size: 13px;
}
.task-card strong {
  font-size: 13px;
  line-height: 1;
}
/* title label compactness handled above (keeps 2-line clamp) */

/* stronger override: target the rendered label and its inner strong to
   ensure the clamp can't be overridden by global/compiled rules */
.task-list .title-text q-item-label,
.task-list .title-text q-item-label strong,
.task-card .title-text q-item-label,
.task-card .title-text q-item-label strong {
  display: -webkit-box !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: normal !important;
  line-height: 1.25em !important;
  max-height: calc(2 * 1.25em + 4px) !important; /* add small buffer for descenders */
}

.title-text q-item-label strong {
  display: block !important;
}

/* explicit class for title clamping (fallback to compiled global helper) */
.title-ellipsis,
.task-card .title-ellipsis,
.task-list .title-ellipsis {
  display: -webkit-box !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: normal !important;
  line-height: 1.25em !important;
  max-height: calc(2 * 1.25em + 4px) !important; /* buffer to avoid clipping descenders */
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

/* compact the hidden-group q-item padding on top/right/bottom */
.hidden-group-item {
  padding: 0px !important;
  /* make left side appear pill-like */
  border-top-left-radius: 26px !important;
  border-bottom-left-radius: 26px !important;
}
</style>
