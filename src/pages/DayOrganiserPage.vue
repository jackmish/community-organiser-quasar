<template>
  <q-page class="q-pa-md">
    <!-- top selector removed; groups shown in the header -->

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center q-pa-lg">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Day View -->
    <div v-else>
      <div class="row q-col-gutter-md tasks-row">
        <!-- Tasks column (left) and Replenishment column (right) -->
        <div class="col-12 left-panel tasks-column">
          <q-card class="task-list-card">
            <q-card-section>
              <div class="text-h6 task-list-header">
                <div
                  class="row items-center justify-between"
                  style="align-items: center; margin-top: 6px"
                >
                  <div class="row items-center" style="gap: 8px">
                    <q-btn flat dense round icon="chevron_left" @click="prevDay" color="primary" />
                    <span class="date-black">{{ getTimeDifferenceDisplay(currentDate) }}</span>
                    <span class="q-mx-sm">|</span>
                    <span :class="['text-weight-bold', getTimeDiffClass(currentDate)]">{{
                      formatDateOnly(currentDate)
                    }}</span>
                    <q-btn flat dense round icon="chevron_right" @click="nextDay" color="primary" />
                  </div>
                  <!-- Insert today's full date/time near the task list header (swapped from main header) -->
                  <div style="display: flex; align-items: center; gap: 8px">
                    <GroupSelectHeader />
                  </div>
                </div>
              </div>
            </q-card-section>
            <q-card-section v-if="sortedTasks.length === 0">
              <p class="text-grey-6">No tasks for this day</p>
            </q-card-section>

            <!-- hidden groups are rendered inside TasksList now -->
            <TasksList
              :key="reloadKey"
              :tasks-with-time="tasksWithTime"
              :tasks-without-time="tasksWithoutTime"
              :hidden-groups="hiddenGroupSummary.groups"
              :replenish-tasks="replenishTasks"
              :selected-task-id="selectedTaskId"
              @task-click="handleTaskClick"
              @toggle-status="toggleStatus"
              @edit-task="editTask"
              @delete-task="handleDeleteTask"
            />
          </q-card>
        </div>
      </div>

      <div class="row q-col-gutter-md q-mt-md">
        <div class="col-12 col-md-8">
          <CalendarView
            :key="reloadKey"
            :selected-date="newTask.eventDate"
            :tasks="allTasks"
            @update:selected-date="handleCalendarDateSelect"
            @preview-task="handleCalendarPreview"
            @edit-task="handleCalendarEdit"
          />
        </div>
        <div class="col-12 col-md-4">
          <div class="q-mb-md">
            <DoneTasksList :done-tasks="doneTasks" @toggle-status="toggleStatus" />
          </div>

          <!-- ModeSwitcher moved to fixed right-side panel -->

          <!-- Replenishment items are rendered with other tasks (no separate right-column panel) -->

          <!-- Preview/Add form moved to fixed right-side panel -->

          <!-- duplicate replenishment card removed (now in tasks row right column) -->

          <!-- Notes removed per layout update -->
        </div>
      </div>
    </div>

    <!-- Group Management Dialog -->
    <GroupManagementDialog
      v-model="showGroupDialog"
      :group-options="groupOptions"
      :group-tree="groupTree"
    />

    <!-- Inline Edit Group Dialog -->
    <q-dialog v-model="showEditGroupDialog">
      <q-card style="min-width: 360px" v-if="editGroupLocal">
        <q-card-section>
          <div class="text-h6">Edit Group</div>
          <div class="q-mt-md">
            <q-input v-model="editGroupLocal.name" label="Group name" outlined dense />
            <q-select
              v-model="editGroupLocal.parentId"
              :options="groupOptions"
              option-value="value"
              option-label="label"
              emit-value
              label="Parent group"
              outlined
              dense
              class="q-mt-sm"
              clearable
            />
            <q-input v-model="editGroupLocal.color" label="Color" outlined dense class="q-mt-sm">
              <template #append>
                <input
                  v-model="editGroupLocal.color"
                  type="color"
                  style="width: 40px; height: 30px; border: none; cursor: pointer"
                />
              </template>
            </q-input>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" @click="cancelEditGroup" />
          <q-btn flat label="Save" color="primary" @click="saveEditedGroup" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- First Run Dialog -->
    <FirstRunDialog v-model="showFirstRunDialog" @create="handleFirstGroupCreation" />

    <!-- Floating Add button: appears in edit/preview or when panel is hidden -->
    <q-btn
      v-if="panelHidden || mode !== 'add'"
      class="floating-add-btn"
      color="green"
      fab
      icon="add"
      dense
      @click="clearTaskToEdit"
      title="Add new task"
    />
    <div :class="['fixed-right-panel', { 'panel-hidden': panelHidden }]">
      <q-btn
        v-if="!panelHidden"
        unelevated
        color="dark"
        class="panel-toggle-btn"
        label="Hide"
        icon="keyboard_arrow_down"
        @click="panelHidden = true"
      />
      <div class="fixed-content">
        <TaskPreview
          v-if="mode === 'preview' && taskToEdit"
          :task="taskToEdit"
          :group-name="getGroupName(taskToEdit.groupId)"
          :animating-lines="animatingLines"
          @line-collapsed="onLineCollapsed"
          @line-expanded="onLineExpanded"
          @edit="
            () => {
              mode = 'edit';
            }
          "
          @close="clearTaskToEdit"
          @toggle-status="(t, i) => toggleStatus(t, i)"
          @update-task="(t) => handleUpdateTask(t)"
          :fixed="false"
        />
        <AddTaskForm
          v-else
          :filtered-parent-options="filteredParentOptions"
          :active-group="activeGroup"
          :show-calendar="false"
          :selected-date="newTask.eventDate"
          :all-tasks="allTasks"
          :replenish-tasks="replenishTasks"
          :initial-task="taskToEdit"
          :mode="mode"
          @update:mode="(v) => (mode = v)"
          @add-task="handleAddTask"
          @update-task="handleUpdateTask"
          @delete-task="handleDeleteTask"
          @cancel-edit="() => clearTaskToEdit()"
          @calendar-date-select="handleCalendarDateSelect"
          @filter-parent-tasks="filterParentTasks"
        />
      </div>
    </div>
    <!-- Show button visible when the panel is hidden and a task is selected (edit/preview) -->
    <q-btn
      v-if="panelHidden && mode !== 'add'"
      class="panel-show-btn"
      unelevated
      color="dark"
      icon="keyboard_arrow_up"
      label="Show"
      @click="panelHidden = false"
    />
  </q-page>
</template>

<script setup lang="ts">
import { format } from 'date-fns';

import AddTaskForm from '../components/AddTaskForm.vue';

import DoneTasksList from '../components/DoneTasksList.vue';
import GroupManagementDialog from '../components/GroupManagementDialog.vue';
import TasksList from '../components/TasksList.vue';
import { timeDiffClassFor, formatDisplayDate } from '../components/theme';
import TaskPreview from '../components/TaskPreview.vue';
import CalendarView from '../components/CalendarView.vue';
import { useLongPress } from '../composables/useLongPress';
import GroupSelectHeader from '../components/GroupSelectHeader.vue';
import { useDayOrganiserView } from 'src/composables/useDayOrganiserView';
import { createLineEventHandlers } from 'src/modules/task/lineEventHandlers';

// Use shared view composable for clock and time-diff helpers
const { now, getTimeDifferenceDisplay, getTimeDiffClass } = useDayOrganiserView();

function selectCalendarDate(dateString: string) {
  // Block rapid clicks
  if (isClickBlocked.value) return;

  // Only update if the date is actually different
  if (newTask.value.eventDate !== dateString) {
    isClickBlocked.value = true;
    newTask.value.eventDate = dateString;
    setCurrentDate(dateString); // Sync the date to the left list

    // Unblock after a short delay
    setTimeout(() => {
      isClickBlocked.value = false;
    }, 100);
  }
}

function handleCalendarDateSelect(dateString: string) {
  selectCalendarDate(dateString);
}

function handleCalendarEdit(taskId: string | null) {
  if (!taskId) return;
  const found = (allTasks.value || []).find((t: any) => t.id === String(taskId));
  if (found) {
    editTask(found);
  }
}

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import logger from 'src/utils/logger';
import { useDayOrganiser } from '../modules/day-organiser';
import type { Task, TaskGroup } from '../modules/day-organiser';
import FirstRunDialog from '../components/FirstRunDialog.vue';
import { occursOnDay, getCycleType } from 'src/utils/occursOnDay';

const $q = useQuasar();

const {
  isLoading,
  currentDate,
  currentDayData,
  loadData,
  addTask,
  deleteTask,
  toggleTaskComplete,
  updateTask,

  getTasksInRange,
  setCurrentDate,

  nextDay,
  prevDay,
  groups,
  activeGroup,
  addGroup,

  getGroupsByParent,
  hiddenGroupSummary,
  previewTaskId,
  previewTaskPayload,
  setPreviewTask,
  undoCycleDone,
} = useDayOrganiser();

// All tasks across days — used to render calendar events
const allTasks = computed(() => {
  try {
    return getTasksInRange('1970-01-01', '9999-12-31');
  } catch (e) {
    return [] as Task[];
  }
});

// `hiddenGroupSummary` moved to the day-organiser module for reuse

const showGroupDialog = ref(false);

const showEditGroupDialog = ref(false);
const editGroupLocal = ref<{
  id: string;
  name: string;
  parentId?: string | null;
  color?: string;
} | null>(null);
const showFirstRunDialog = ref(false);

const defaultGroupId = ref<string | undefined>(undefined);
const openDeleteMenu = ref<string | null>(null);
const taskToEdit = ref<Task | null>(null);
const mode = ref<'add' | 'edit' | 'preview'>('add');
// when true the fixed panel is moved off-screen (hidden) and only the show button is visible
const panelHidden = ref(false);
const selectedTaskId = ref<string | null>(null);
const reloadKey = ref(0);
const animatingLines = ref<number[]>([]);
// track pending toggle operations to avoid overlapping/duplicate toggles causing transient flips
const pendingToggles = new Map<string, boolean>();
// pending promises for child line animation events (moved to task module)
const { pendingLineEvents, waitForLineEvent, onLineCollapsed, onLineExpanded } =
  createLineEventHandlers();

// outer-scope handlers for window events (registered/assigned inside onMounted)
let organiserReloadHandler: any = null;
let organiserGroupManageHandler: any = null;

// Register cleanup synchronously during setup so lifecycle hook is valid
onBeforeUnmount(() => {
  try {
    if (organiserReloadHandler)
      window.removeEventListener('organiser:reloaded', organiserReloadHandler as EventListener);
    if (organiserGroupManageHandler)
      window.removeEventListener('group:manage', organiserGroupManageHandler as EventListener);
  } catch (e) {
    // ignore
  }
});

// Allowed modes depend on whether a task is selected.
// Do not expose the 'add' option here (floating add button handles creation).
const allowedModes = computed(() => (taskToEdit.value ? ['preview', 'edit'] : []));

// Ensure we return to 'add' mode when no task is selected
watch(taskToEdit, (val) => {
  if (!val && mode.value !== 'add') {
    mode.value = 'add';
  }
});

function setTaskToEdit(task: Task) {
  // If this is a cyclic/occurring task, attach the current visible date
  // so the preview shows the occurrence date rather than the base creation date.
  let toShow: Task = task;
  try {
    const cycle = getCycleType(task);
    if (cycle) {
      toShow = { ...(task as any) } as Task;
      (toShow as any).date = currentDate.value;
    }
  } catch (e) {
    // ignore and fall back to the original task
  }

  taskToEdit.value = toShow;
  // show preview when a task is clicked
  mode.value = 'preview';
  // ensure panel is visible when selecting a task
  panelHidden.value = false;
  selectedTaskId.value = toShow.id;
}

function editTask(task: Task) {
  taskToEdit.value = task;
  mode.value = 'edit';
  // ensure panel is visible when entering edit
  panelHidden.value = false;
  selectedTaskId.value = task.id;
}

function clearTaskToEdit() {
  taskToEdit.value = null;
  mode.value = 'add';
  selectedTaskId.value = null;
  // ensure the right-side panel is visible when switching to create mode
  panelHidden.value = false;
}

async function saveEditedGroup() {
  if (!editGroupLocal.value) return;
  const { id, name, parentId, color } = editGroupLocal.value;
  if (!name || !name.trim()) return;
  try {
    const { updateGroup } = useDayOrganiser();
    const updates: Partial<Omit<TaskGroup, 'id' | 'createdAt'>> = {};
    updates.name = name.trim();
    if (parentId !== undefined && parentId !== null) updates.parentId = parentId as any;
    if (color !== undefined && color !== null) updates.color = color as any;
    await updateGroup(id, updates);
  } catch (e) {
    logger.error('updateGroup failed', e);
  }
  showEditGroupDialog.value = false;
  editGroupLocal.value = null;
}

function cancelEditGroup() {
  showEditGroupDialog.value = false;
  editGroupLocal.value = null;
}

// When parent switches to 'add' mode (via ModeSwitcher), ensure no task remains selected
watch(mode, (val) => {
  if (val === 'add') {
    taskToEdit.value = null;
    selectedTaskId.value = null;
  }
});

// Respond to preview requests coming from other parts of the app
watch(
  () => previewTaskId && (previewTaskId as any).value,
  (id) => {
    if (!id) return;
    // find task by id using the precomputed allTasks list (avoids awkward any/never types)
    let found: Task | null = null;
    try {
      const sid = String(id);
      found = (allTasks.value || []).find((t) => t.id === sid) || null;
    } catch (e) {
      found = null;
    }
    if (found) {
      // If this is a cyclic/occurring task, prefer to show it with the
      // currently visible date so the preview displays the occurrence.
      let toShow: Task = found;
      try {
        const cycle = getCycleType(found as any);
        if (cycle) {
          toShow = { ...(found as any) } as Task;
          (toShow as any).date = currentDate.value;
        }
      } catch (e) {
        // ignore
      }

      taskToEdit.value = toShow;
      mode.value = 'preview';
      selectedTaskId.value = toShow.id;
      // also ensure the calendar/date syncs to the task date
      try {
        setCurrentDate((toShow as any).date || toShow.eventDate || null);
      } catch (e) {
        // ignore
      }
    }
    // clear preview request after handling
    try {
      setPreviewTask(null);
    } catch (e) {
      // ignore
    }
  },
);

// If a payload was provided (e.g. from notifications) use it to preview the task
watch(
  () => previewTaskPayload && (previewTaskPayload as any).value,
  (payload) => {
    if (!payload) return;
    try {
      handleCalendarPreview(payload);
    } catch (e) {
      // ignore
    }
    // clear payload after handling
    try {
      setPreviewTask(null);
    } catch (e) {
      void 0;
    }
  },
);

// Handle preview event from calendar (may pass either id string or full event object)
function handleCalendarPreview(payload: any) {
  if (!payload) return;
  let found: Task | null = null;
  try {
    if (typeof payload === 'string' || typeof payload === 'number') {
      const sid = String(payload);
      found = (allTasks.value || []).find((t) => t.id === sid) || null;
    } else if (payload && payload.id) {
      // Prefer to find canonical task by id and then attach occurrence date
      const sid = String(payload.id);
      const base = (allTasks.value || []).find((t) => t.id === sid) || null;
      if (base) {
        // shallow clone and attach occurrence date if provided
        found = { ...(base as any) } as Task;
        const occ = payload.date || payload._date || payload._dateStr || payload.eventDate;
        if (occ) (found as any).date = occ;
      } else {
        // fallback to using payload as the task object
        found = payload as Task;
      }
    }
  } catch (e) {
    found = null;
  }
  if (found) {
    taskToEdit.value = found;
    mode.value = 'preview';
    selectedTaskId.value = found.id;
    try {
      setCurrentDate((found as any).date || found.date || found.eventDate || null);
    } catch (e) {
      // ignore
    }
  }
}

// Refs for date inputs

const timeType = ref<'wholeDay' | 'exactHour'>('wholeDay');

const isClickBlocked = ref(false);
// Long-press handling via composable
const { longPressTriggered, setLongPressHandler } = useLongPress();

// Register page's edit handler with the composable
setLongPressHandler(editTask);

function handleTaskClick(task: Task) {
  if (longPressTriggered.value) {
    // consumed by long-press; reset flag and do nothing
    longPressTriggered.value = false;
    return;
  }
  setTaskToEdit(task);
}

// Watch timeType to clear time when "Whole Day" is selected
watch(timeType, (newValue) => {
  if (newValue === 'wholeDay') {
    newTask.value.eventTime = '';
  }
});

const newTask = ref({
  name: '',
  description: '',
  type_id: 'TimeEvent',
  status_id: '',
  parent_id: null as string | null,
  created_by: '',
  priority: 'medium' as Task['priority'],
  completed: false,
  groupId: undefined as string | undefined,
  eventDate: format(new Date(), 'yyyy-MM-dd'),
  eventTime: '',
});

const typeOptions = [
  { label: 'Command center', value: 'Command center', icon: 'dashboard' },
  { label: 'Note/Later', value: 'Note/Later', icon: 'note' },
  { label: 'TimeEvent', value: 'TimeEvent', icon: 'event' },
  { label: 'Replenishment', value: 'Replenishment', icon: 'shopping_cart' },
];

const parentTaskOptions = computed(() => {
  const val = currentDayData.value.tasks.map((task) => ({
    label: task.name,
    value: task.id,
    icon: typeOptions.find((t) => t.value === task.category)?.icon || 'task',
  }));
  return val;
});

const filteredParentOptions = ref(parentTaskOptions.value);

// Update filtered options when parent task options change
watch(parentTaskOptions, (newOptions) => {
  filteredParentOptions.value = newOptions;
});

// Sync calendar date with current date when using arrow navigation
watch(currentDate, (newDate) => {
  if (newTask.value.eventDate !== newDate) {
    newTask.value.eventDate = newDate;
  }
});

const filterParentTasks = (val: string, update: (fn: () => void) => void) => {
  update(() => {
    if (val === '') {
      filteredParentOptions.value = parentTaskOptions.value;
    } else {
      const needle = val.toLowerCase();
      filteredParentOptions.value = parentTaskOptions.value.filter(
        (option) => option.label.toLowerCase().indexOf(needle) > -1,
      );
    }
  });
};

// Parse YYYY-MM-DD into a local Date (avoids timezone shifts with ISO parsing)
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

// Return offset days for a task; use the task's value or 0 when missing/invalid
const getTimeOffsetDaysForTask = (t: any): number => {
  const raw = t && t.timeOffsetDays;
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = Number(raw);
  return isNaN(n) ? 0 : Math.max(0, Math.floor(n));
};

const sortedTasks = computed(() => {
  // Filter tasks by active group (unless "All Groups" is selected)
  // Start with tasks for the currently selected date
  let tasksToSort = currentDayData.value.tasks.slice();

  // If we're viewing Today, also include any tasks of type `Todo` from other days
  // so they appear in today's list. They should not show when viewing other days.
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    if (currentDate.value === todayStr && typeof getTasksInRange === 'function') {
      const allTasks = getTasksInRange('1970-01-01', '9999-12-31');
      const todoExtras = allTasks.filter((t) => t.type_id === 'Todo');
      // Merge without duplicating tasks already present for today
      for (const t of todoExtras) {
        if (!tasksToSort.some((existing) => existing.id === t.id)) {
          tasksToSort.push(t);
        }
      }
      // Also include prepare/expiration tasks from other days when viewing Today
      try {
        const prepExtras = allTasks.filter((t) => {
          // Keep 'prepare' reminders visible even if they are marked done (status_id === 0)
          if (t.type_id === 'Replenish') return false;
          const mode = (t as any).timeMode || 'event';
          if (Number(t.status_id) === 0 && mode !== 'prepare') return false;
          if (mode !== 'prepare' && mode !== 'expiration') return false;
          const ev = (t.date || t.eventDate) as string | undefined | null;
          if (!ev) return false;
          const evDate = parseYmdLocal(ev);
          const todayDate = parseYmdLocal(todayStr);
          if (!evDate || !todayDate) return false;
          const msPerDay = 1000 * 60 * 60 * 24;
          const diffDays = Math.floor((evDate.getTime() - todayDate.getTime()) / msPerDay);
          const offset = getTimeOffsetDaysForTask(t);
          if (mode === 'prepare') {
            return diffDays >= 0 && diffDays <= offset;
          }
          // expiration: show starting from eventDate - offset and continue showing after event until done
          return diffDays <= offset;
        });
        for (const t of prepExtras) {
          if (!tasksToSort.some((existing) => existing.id === t.id)) tasksToSort.push(t);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    // Ignore: if getTasksInRange isn't available or fails, fall back to just today's tasks
    logger.warn('Failed to include Todo extras for today', err);
  }
  // Helper to check whether a task group is visible for the current active group.
  const isVisibleForActive = (candidateId: any) => {
    if (!activeGroup.value || activeGroup.value.value === null) return true;
    if (candidateId == null) return false;
    const activeId = String(activeGroup.value.value);
    const cid = String(candidateId);
    if (cid === activeId) return true;

    const getGroupById = (id: any) =>
      (groups.value || []).find((g: any) => String(g.id) === String(id));
    const node = getGroupById(cid);
    if (!node) return false;

    // If node is direct child of active group, show it unless the child hides tasks from parent
    const parentId = node.parentId ?? node.parent_id ?? null;
    if (parentId == null) return false;
    if (String(parentId) === activeId) {
      if (node.hideTasksFromParent) return false;
      return true;
    }

    // For deeper descendants, walk upwards from the node's parent and ensure
    // none of the intermediate child nodes request hiding from their parent,
    // and each ancestor has shareSubgroups === true.
    let childNode: any = node;
    let cur = getGroupById(parentId);
    while (cur) {
      // if the child requests hiding from its immediate parent, do not show
      if (childNode && childNode.hideTasksFromParent) return false;
      if (!cur.shareSubgroups) return false;
      const curParent = cur.parentId ?? cur.parent_id ?? null;
      if (curParent == null) return false;
      if (String(curParent) === activeId) return true;
      childNode = cur;
      cur = getGroupById(curParent);
    }
    return false;
  };

  // Remove tasks that are stored on this date but are cyclic and shouldn't occur today
  try {
    const dayStr = currentDate.value;
    const isCyclicNotOccurring = (task: any) => {
      const cycle = getCycleType(task);
      if (!cycle) return false;
      try {
        const occurs = occursOnDay(task, dayStr);
        return !occurs;
      } catch (err) {
        return false;
      }
    };

    tasksToSort = tasksToSort.filter((t) => !isCyclicNotOccurring(t));
  } catch (e) {
    // ignore
  }

  // Include cyclic occurrences: find tasks across allTasks whose repeat rules make them occur
  // on the currently selected date, and merge them in (avoid duplicates).
  try {
    const full = allTasks.value || [];
    const day = currentDate.value;

    for (const t of full) {
      if (Number(t.status_id) === 0) continue; // skip done
      if (t.type_id === 'Replenish') continue;
      if (occursOnDay(t, day)) {
        // avoid duplicates: if task with same id already present, skip
        if (!tasksToSort.some((existing) => existing.id === t.id)) {
          const clone = { ...t, eventDate: day };
          // mark as generated instance so UI can show it differently if needed
          (clone as any).__isCyclicInstance = true;
          // Respect group visibility for generated occurrences
          if (isVisibleForActive(clone.groupId)) tasksToSort.push(clone);
        }
      }
    }
    // Ensure tasks list respects active group visibility after merging generated items
    tasksToSort = tasksToSort.filter((task) => isVisibleForActive(task.groupId));
  } catch (e) {
    // ignore errors here
  }

  const val = [...tasksToSort].sort((a, b) => {
    // Tasks with time come first, sorted by time
    const hasTimeA = !!a.eventTime;
    const hasTimeB = !!b.eventTime;

    if (hasTimeA && !hasTimeB) return -1; // a has time, b doesn't - a comes first
    if (!hasTimeA && hasTimeB) return 1; // b has time, a doesn't - b comes first

    if (hasTimeA && hasTimeB) {
      // Both have time - sort by time
      return a.eventTime!.localeCompare(b.eventTime!);
    }

    // Neither has time - sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityCompare = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityCompare !== 0) return priorityCompare;

    return 0;
  });
  return val;
});

// Replenish restore is now handled inside AddTaskForm component

// Replenishment list: show all active Replenish tasks regardless of date
const replenishTasks = computed(() => {
  try {
    const all = allTasks.value || [];
    let val = all.filter((t) => t.type_id === 'Replenish' && Number(t.status_id) !== 0);
    if (activeGroup.value && activeGroup.value.value !== null) {
      const activeId = String(activeGroup.value.value);
      const getGroupById = (id: any) =>
        (groups.value || []).find((g: any) => String(g.id) === String(id));
      const isVisibleForActive = (candidateId: any) => {
        if (candidateId == null) return false;
        const cid = String(candidateId);
        if (cid === activeId) return true;
        const node = getGroupById(cid);
        if (!node) return false;
        const parentId = node.parentId ?? node.parent_id ?? null;
        if (parentId == null) return false;
        if (String(parentId) === activeId) {
          if (node.hideTasksFromParent) return false;
          return true;
        }
        let childNode: any = node;
        let cur = getGroupById(parentId);
        while (cur) {
          if (childNode && childNode.hideTasksFromParent) return false;
          if (!cur.shareSubgroups) return false;
          const curParent = cur.parentId ?? cur.parent_id ?? null;
          if (curParent == null) return false;
          if (String(curParent) === activeId) return true;
          childNode = cur;
          cur = getGroupById(curParent);
        }
        return false;
      };

      val = val.filter((t) => isVisibleForActive(t.groupId));
    }
    // sort by name for stable display
    val = val.sort((a: any, b: any) => {
      const na = (a.name || '').toLowerCase();
      const nb = (b.name || '').toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });
    return val;
  } catch (e) {
    return [];
  }
});

// Tasks that are marked done (status_id === 0) or cyclic occurrences marked done via history
// Include Replenish tasks from allTasks (date-independent) so they appear in the Done list
const doneTasks = computed(() => {
  const day = currentDate.value;
  const done = sortedTasks.value.filter((t) => {
    try {
      // Determine effective timeMode (task instance or base task)
      const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
      const mode = (t && t.timeMode) || (base && base.timeMode) || 'event';
      // Exclude 'prepare' mode tasks from Done list even if marked done
      if (mode === 'prepare') return false;
      if (Number(t.status_id) === 0) return true;
      const cycle = getCycleType(t);
      if (!cycle) return false;
      const hist = (base as any).history || [];
      return hist.some((h: any) => h && h.type === 'cycleDone' && h.date === day);
    } catch (e) {
      return false;
    }
  });

  try {
    const all = allTasks.value || [];
    let replenishDone = all.filter(
      (t: any) => t.type_id === 'Replenish' && Number(t.status_id) === 0,
    );
    if (activeGroup.value && activeGroup.value.value !== null) {
      const activeId = String(activeGroup.value.value);
      const getGroupById = (id: any) =>
        (groups.value || []).find((g: any) => String(g.id) === String(id));
      const isVisibleForActive = (candidateId: any) => {
        if (candidateId == null) return false;
        const cid = String(candidateId);
        if (cid === activeId) return true;
        let childNode: any = getGroupById(cid);
        let cur = getGroupById(cid);
        while (cur) {
          const pid = cur.parentId ?? cur.parent_id ?? null;
          if (pid == null) return false;
          // if current node is direct child of active, respect its hide flag
          if (String(pid) === activeId) {
            if (childNode && childNode.hideTasksFromParent) return false;
            return Boolean(cur.shareSubgroups);
          }
          if (childNode && childNode.hideTasksFromParent) return false;
          if (!cur.shareSubgroups) return false;
          childNode = cur;
          cur = getGroupById(pid);
        }
        return false;
      };

      replenishDone = replenishDone.filter((t: any) => isVisibleForActive(t.groupId));
    }
    // Merge replenishDone into done, avoiding duplicates by id
    const existingIds = new Set(done.map((d: any) => d.id));
    for (const r of replenishDone) {
      if (!existingIds.has(r.id)) done.push(r);
    }
  } catch (e) {
    // ignore
  }

  return [...done].sort((a, b) => {
    const getTime = (task: any) => {
      const ts = task.updatedAt ?? task.createdAt ?? task.updated_at ?? task.created_at ?? null;
      return ts ? new Date(ts).getTime() : 0;
    };
    const hasStar = (task: any) => {
      try {
        const desc = (task && task.description) || '';
        return desc.split(/\r?\n/).some((l: string) => /\*\s*$/.test(l));
      } catch (e) {
        return false;
      }
    };
    const wa = hasStar(a) ? 1 : 0;
    const wb = hasStar(b) ? 1 : 0;
    if (wa !== wb) return wb - wa; // starred tasks first
    return getTime(b) - getTime(a);
  });
});

const tasksWithTime = computed(() => {
  const day = currentDate.value;
  const val = sortedTasks.value.filter((t) => {
    if (t.type_id === 'Replenish') return false;
    // Keep 'prepare' mode tasks visible even if their status is done
    try {
      const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
      const mode = (t && t.timeMode) || (base && base.timeMode) || 'event';
      if (Number(t.status_id) === 0 && mode !== 'prepare') return false;
    } catch (e) {
      // ignore
    }
    try {
      const cycle = getCycleType(t);
      if (cycle) {
        const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
        const hist = (base as any).history || [];
        if (
          Array.isArray(hist) &&
          hist.some((h: any) => h && h.type === 'cycleDone' && h.date === day)
        )
          return false;
      }
    } catch (e) {
      // ignore
    }
    // time-mode visibility: if task has timeMode 'prepare' or 'expiration', decide
    // whether it should be visible on this `day` based on its eventDate and offset
    try {
      const mode = t.timeMode || 'event';
      if (mode === 'prepare' || mode === 'expiration') {
        const ev = (t.date || t.eventDate) as string | undefined | null;
        if (!ev) return false;
        const offset = getTimeOffsetDaysForTask(t);
        const msPerDay = 1000 * 60 * 60 * 24;
        const evDate = parseYmdLocal(ev);
        const thisDate = parseYmdLocal(day);
        if (!evDate || !thisDate) return false;
        const diffDays = Math.floor((evDate.getTime() - thisDate.getTime()) / msPerDay);
        if (mode === 'prepare') {
          // show only in the window [eventDate - offset, eventDate]
          if (!(diffDays >= 0 && diffDays <= offset)) return false;
        } else if (mode === 'expiration') {
          // show starting from eventDate - offset and continue showing after event until done
          if (!(diffDays <= offset)) return false;
        }
      }
    } catch (e) {
      // ignore and fall back
    }
    return !!t.eventTime;
  });
  return val;
});
const tasksWithoutTime = computed(() => {
  const day = currentDate.value;
  const val = sortedTasks.value.filter((t) => {
    if (t.type_id === 'Replenish') return false;
    // Keep 'prepare' mode tasks visible even if their status is done
    try {
      const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
      const mode = (t && t.timeMode) || (base && base.timeMode) || 'event';
      if (Number(t.status_id) === 0 && mode !== 'prepare') return false;
    } catch (e) {
      // ignore
    }
    try {
      const cycle = getCycleType(t);
      if (cycle) {
        const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
        const hist = (base as any).history || [];
        if (
          Array.isArray(hist) &&
          hist.some((h: any) => h && h.type === 'cycleDone' && h.date === day)
        )
          return false;
      }
    } catch (e) {
      // ignore
    }
    // include prepare/expiration tasks on appropriate days even if they have no eventTime
    try {
      const mode = t.timeMode || 'event';
      if (mode === 'prepare' || mode === 'expiration') {
        const ev = (t.date || t.eventDate) as string | undefined | null;
        if (!ev) return false;
        const offset = getTimeOffsetDaysForTask(t);
        const msPerDay = 1000 * 60 * 60 * 24;
        const evDate = parseYmdLocal(ev);
        const thisDate = parseYmdLocal(day);
        if (!evDate || !thisDate) return false;
        const diffDays = Math.floor((evDate.getTime() - thisDate.getTime()) / msPerDay);
        if (mode === 'prepare') {
          if (!(diffDays >= 0 && diffDays <= offset)) return false;
        } else if (mode === 'expiration') {
          if (!(diffDays <= offset)) return false;
        }
      }
    } catch (e) {
      // ignore and fall back
    }
    return !t.eventTime;
  });
  return val;
});

// Group options for select
const groupOptions = computed(() => {
  const byParent: Record<string, any[]> = {};
  (groups.value || []).forEach((g) => {
    const key = g.parentId ?? g.parent_id ?? '__root__';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(g);
  });

  const flat: any[] = [];
  const walk = (parentKey: string, depth = 0) => {
    const list = byParent[parentKey] || [];
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    list.forEach((g) => {
      flat.push({ label: `${'\u00A0'.repeat(depth * 2)}${g.name}`, value: String(g.id) });
      walk(g.id, depth + 1);
    });
  };

  walk('__root__', 0);
  return flat;
});

// Active group options with "All Groups" and task counts
const activeGroupOptions = computed(() => {
  const allTasks = currentDayData.value.tasks;
  const totalTaskCount = allTasks.length;

  const options = [
    {
      label: `All Groups (${totalTaskCount})`,
      value: null,
    },
    ...groups.value.map((g) => {
      const taskCount = allTasks.filter((t) => t.groupId === g.id).length;
      return {
        label: `${g.name} (${taskCount})`,
        value: String(g.id),
      };
    }),
  ];

  return options;
});

// Build group tree for display
const groupTree = computed(() => {
  const buildTree = (parentId?: string): any[] => {
    const pidNorm = parentId == null ? undefined : String(parentId);
    // debug: removed console logging
    const groupsForParent = getGroupsByParent(pidNorm);
    try {
      logger.debug('[DayOrganiserPage] buildTree parent=', pidNorm, parentId);
    } catch (e) {
      // ignore
    }
    return groupsForParent.map((group) => ({
      id: String(group.id),
      label: group.name,
      color: group.color,
      icon: group.icon || 'folder',
      // reference the original group object (do not copy or mutate it)
      group: group,
      children: buildTree(String(group.id)),
    }));
  };
  const val = buildTree();

  return val;
});

// Return weekday and compact date (e.g., "Tuesday, 23.12.2025")
const formatDateOnly = (date: string) => formatDisplayDate(date);

const getGroupName = (groupId?: string): string => {
  if (!groupId) return 'Unknown';
  const group = groups.value.find((g) => g.id === groupId);
  return group ? group.name : 'Unknown';
};

const handleAddTask = async (taskPayload: any, opts?: { preview?: boolean }) => {
  // Ensure there's a group to assign: prefer payload.groupId, otherwise active group
  const groupIdToUse = taskPayload?.groupId ?? activeGroup.value?.value ?? null;
  if (groupIdToUse === null || groupIdToUse === undefined) {
    $q.notify({
      type: 'warning',
      message: 'Please select an active group first (not "All Groups")',
      position: 'top',
    });
    return;
  }

  // Validate payload
  if (!taskPayload || !taskPayload.name) return;

  // Determine which date the task should belong to: prefer explicit payload.date or payload.eventDate
  const targetDate =
    (taskPayload && (taskPayload.date || taskPayload.eventDate)) || currentDate.value;

  // Build task data and add to the computed day
  const taskData: any = {
    ...taskPayload,
    date: taskPayload?.date || taskPayload?.eventDate || targetDate,
    groupId: groupIdToUse,
  };

  const created = await addTask(targetDate, taskData);
  if (opts && opts.preview && created) {
    taskToEdit.value = created as any;
    mode.value = 'preview';
    selectedTaskId.value = created.id;
    try {
      setCurrentDate((created as any).date || (created as any).eventDate || null);
    } catch (e) {
      // ignore
    }
  }
};

const handleUpdateTask = async (updatedTask: any) => {
  if (!updatedTask || !updatedTask.id) return;
  const { id, ...rest } = updatedTask;
  // Determine which date bucket the task belongs to: prefer explicit `date`, then `eventDate`, otherwise current view
  const targetDate =
    (updatedTask.date as string) || (updatedTask.eventDate as string) || currentDate.value;
  await updateTask(targetDate, id, rest);
  // Find the updated task in the global task list and show it in preview
  const updated = (allTasks.value || []).find((t) => t.id === id) || null;
  taskToEdit.value = updated as any;
  if (updated) {
    mode.value = 'preview';
    selectedTaskId.value = id;
    // Do not change the active calendar day after updating a task
  } else {
    // fallback: no task found, ensure we return to add mode
    mode.value = 'add';
    selectedTaskId.value = null;
  }
};

const handleDeleteTask = async (payload: any) => {
  try {
    let id: string | undefined;
    let date: string = currentDate.value;
    if (!payload) return;
    if (typeof payload === 'string') {
      id = payload;
    } else if (typeof payload === 'object') {
      id = payload.id;
      if (payload.date) date = payload.date;
    }
    if (!id) return;
    await deleteTask(date, id);
    // If the deleted task was currently selected for preview/edit, switch back to create mode
    if (taskToEdit.value && taskToEdit.value.id === id) {
      taskToEdit.value = null;
      mode.value = 'add';
      selectedTaskId.value = null;
    }
  } finally {
    openDeleteMenu.value = null;
  }
};

// `lineIndex?: number`: when provided toggles a specific checklist line
// inside the task's description instead of toggling the whole task.
const toggleStatus = async (task: any, lineIndex?: number) => {
  // Prefer the task's own date for cyclic tasks, otherwise use the currently
  // selected calendar date. This ensures generated cyclic instances use their
  // occurrence date when persisting per-occurrence completions.
  const isCyclic = Boolean(getCycleType(task));
  const targetDate = !isCyclic
    ? task.date || task.eventDate || currentDate.value
    : currentDate.value;
  // status used for non-cyclic optimistic toggles — declare in outer scope
  let status = Number(task.status_id) === 0 ? 1 : 0;
  // If this is a 'prepare' time-mode task and user is trying to mark it done,
  // notify the user that preparation was recorded. Do NOT return here so the
  // status update still proceeds; the Done list will exclude prepare tasks.
  if (status === 0 && task.timeMode === 'prepare') {
    try {
      $q.notify({
        type: 'info',
        message: `Preparation recorded${task && task.name ? ': ' + task.name : ''}`,
        position: 'top',
      });
    } catch (e) {
      // ignore notification errors
    }
  }
  try {
    // Debug: help trace toggle attempts for cyclic occurrences
    const baseCheck = (allTasks.value || []).find((x: any) => x.id === task.id) || null;
    logger.debug(
      '[toggleStatus] taskId=',
      task?.id,
      'instanceDate=',
      (task && (task.date || task.eventDate)) || null,
      'targetDate=',
      targetDate,
      'isCyclic=',
      isCyclic,
      'isInstance=',
      Boolean(task?.__isCyclicInstance),
      'instanceHistoryLen=',
      (task?.history || []).length || 0,
      'baseHistoryLen=',
      baseCheck && baseCheck.history ? baseCheck.history.length : 0,
    );
  } catch (e) {
    // ignore
  }
  // If a line index is provided, toggle only that line's checked marker inside the description
  if (typeof lineIndex === 'number' && task && typeof task.description === 'string') {
    const pendingKey = `${task.id}:line:${lineIndex}`;
    if (pendingToggles.get(pendingKey)) return;
    pendingToggles.set(pendingKey, true);
    const lines = task.description.split(/\r?\n/);
    let appendedIndex: number | undefined = undefined;
    const ln = lines[lineIndex] ?? '';

    const dashMatch = ln.match(/^(\s*-\s*)(\[[xX]\]\s*)?(.*)$/);
    const numMatch = ln.match(/^(\s*\d+[.)]\s*)(\[[xX]\]\s*)?(.*)$/);

    if (dashMatch) {
      const prefix = dashMatch[1];
      const marker = dashMatch[2] || '';
      const content = dashMatch[3] || '';
      const checked = /^\s*\[[xX]\]\s*/.test(marker);
      if (checked) {
        // unchecked: move to top behind title (second line) unless already there.
        // If the undone item has NO trailing star, append it after the last starred undone item.
        const hasTitleInDesc = Boolean(lines[0] && lines[0].trim() !== '');
        const baseInsertIndex = hasTitleInDesc ? 1 : 0;
        const hadStar = /\s*\*\s*$/.test(content);
        // If the user toggled the actual title line (index 0 when title present), don't move it.
        if (lineIndex === 0 && hasTitleInDesc) {
          lines[lineIndex] = `${prefix}${content}`;
        } else {
          // find where completed items start so we only consider the undone section
          const completedStart = lines.findIndex(
            (ln: string) => /^\s*-\s*\[[xX]\]/.test(ln) || /^\s*\d+[.)]\s*\[[xX]\]/.test(ln),
          );
          const undoneEnd = completedStart === -1 ? lines.length : completedStart;
          // find last starred undone item
          let lastStarIndex = -1;
          for (let i = baseInsertIndex; i < undoneEnd; i++) {
            try {
              if (/\*\s*$/.test(lines[i])) lastStarIndex = i;
            } catch (e) {
              // ignore
            }
          }
          // decide final insert position: starred undone items go to top; unstarred go after last starred undone
          let finalInsert = baseInsertIndex;
          if (!hadStar && lastStarIndex !== -1) finalInsert = lastStarIndex + 1;
          // if already in final spot (taking shifts into account), just remove marker in-place
          const adjustedFinal = finalInsert > lineIndex ? finalInsert - 1 : finalInsert;
          if (lineIndex === adjustedFinal) {
            lines[lineIndex] = `${prefix}${content}`;
          } else {
            animatingLines.value = [lineIndex];
            await waitForLineEvent(task.id, lineIndex, 'collapsed');
            const movedLine = `${prefix}${content}`;
            lines.splice(lineIndex, 1);
            lines.splice(adjustedFinal, 0, movedLine);
            appendedIndex = adjustedFinal;
          }
        }
      } else {
        // animate then mark done and move this subtask to the end (or into starred-top area)
        animatingLines.value = [lineIndex];
        await waitForLineEvent(task.id, lineIndex, 'collapsed');
        // detect trailing star on the original content
        const hadStar = /\s*\*\s*$/.test(content);
        const cleanContent = content.replace(/\s*\*\s*$/, '');
        const completedLine = `${prefix}[x] ${cleanContent}${hadStar ? ' *' : ''}`;
        // remove the original line first
        lines.splice(lineIndex, 1);
        if (hadStar) {
          // insert at the start of the completed-block: find first completed item index
          const completedStart = lines.findIndex(
            (ln: string) =>
              /^(\s*-\s*\[[xX]\]\s*)/.test(ln) || /^(\s*\d+[.)]\s*\[[xX]\]\s*)/.test(ln),
          );
          if (completedStart === -1) {
            lines.push(completedLine);
            appendedIndex = lines.length - 1;
          } else {
            lines.splice(completedStart, 0, completedLine);
            appendedIndex = completedStart;
          }
        } else {
          lines.push(completedLine);
          appendedIndex = lines.length - 1;
        }
      }
      const newDesc = lines.join('\n');
      // update the task description after animation
      try {
        task.description = newDesc;
        if (taskToEdit.value && taskToEdit.value.id === task.id) {
          taskToEdit.value.description = newDesc;
        }
      } catch (e) {
        // ignore
      }
      // If we recorded an appendedIndex above, signal expansion now that DOM will update
      try {
        if (typeof appendedIndex !== 'undefined') {
          await nextTick();
          animatingLines.value = [-(appendedIndex + 1)];
          await waitForLineEvent(task.id, appendedIndex, 'expanded');
        }
      } catch (e) {
        // ignore
      }
      animatingLines.value = [];
      try {
        await updateTask(targetDate, task.id, { description: newDesc });
      } finally {
        pendingToggles.delete(pendingKey);
      }
      return;
    }

    if (numMatch) {
      const prefix = numMatch[1];
      const marker = numMatch[2] || '';
      const content = numMatch[3] || '';
      const checked = /^\s*\[[xX]\]\s*/.test(marker);
      if (checked) {
        // unchecked numeric item -> move to top behind title unless already there.
        // If the undone item has NO trailing star, append it after the last starred undone item.
        const hasTitleInDesc = Boolean(lines[0] && lines[0].trim() !== '');
        const baseInsertIndex = hasTitleInDesc ? 1 : 0;
        const hadStar = /\s*\*\s*$/.test(content);
        if (lineIndex === 0 && hasTitleInDesc) {
          lines[lineIndex] = `${prefix}${content}`;
        } else {
          const completedStart = lines.findIndex(
            (ln: string) => /^\s*-\s*\[[xX]\]/.test(ln) || /^\s*\d+[.)]\s*\[[xX]\]/.test(ln),
          );
          const undoneEnd = completedStart === -1 ? lines.length : completedStart;
          let lastStarIndex = -1;
          for (let i = baseInsertIndex; i < undoneEnd; i++) {
            try {
              if (/\*\s*$/.test(lines[i])) lastStarIndex = i;
            } catch (e) {
              // ignore
            }
          }
          let finalInsert = baseInsertIndex;
          if (!hadStar && lastStarIndex !== -1) finalInsert = lastStarIndex + 1;
          const adjustedIndex = finalInsert > lineIndex ? finalInsert - 1 : finalInsert;
          if (lineIndex === adjustedIndex) {
            lines[lineIndex] = `${prefix}${content}`;
          } else {
            animatingLines.value = [lineIndex];
            await waitForLineEvent(task.id, lineIndex, 'collapsed');
            const movedLine = `${prefix}${content}`;
            lines.splice(lineIndex, 1);
            lines.splice(adjustedIndex, 0, movedLine);
            appendedIndex = adjustedIndex;
          }
        }
      } else {
        // animate then convert numeric item into a completed bullet at the end (or into starred-top area)
        animatingLines.value = [lineIndex];
        await waitForLineEvent(task.id, lineIndex, 'collapsed');
        const hadStar = /\s*\*\s*$/.test(content);
        const cleanContent = content.replace(/\s*\*\s*$/, '');
        const completedLine = `- [x] ${cleanContent}${hadStar ? ' *' : ''}`;
        lines.splice(lineIndex, 1);
        if (hadStar) {
          const completedStart = lines.findIndex(
            (ln: string) =>
              /^(\s*-\s*\[[xX]\]\s*)/.test(ln) || /^(\s*\d+[.)]\s*\[[xX]\]\s*)/.test(ln),
          );
          if (completedStart === -1) {
            lines.push(completedLine);
            appendedIndex = lines.length - 1;
          } else {
            lines.splice(completedStart, 0, completedLine);
            appendedIndex = completedStart;
          }
        } else {
          lines.push(completedLine);
          appendedIndex = lines.length - 1;
        }
      }
      const newDesc = lines.join('\n');
      try {
        task.description = newDesc;
        if (taskToEdit.value && taskToEdit.value.id === task.id) {
          taskToEdit.value.description = newDesc;
        }
      } catch (e) {
        // ignore
      }
      // If we recorded an appendedIndex above, signal expansion now that DOM will update
      try {
        if (typeof appendedIndex !== 'undefined') {
          await nextTick();
          animatingLines.value = [-(appendedIndex + 1)];
          await waitForLineEvent(task.id, appendedIndex, 'expanded');
        }
      } catch (e) {
        // ignore
      }
      animatingLines.value = [];
      try {
        await updateTask(targetDate, task.id, { description: newDesc });
      } finally {
        pendingToggles.delete(pendingKey);
      }
      return;
    }
    // Not a list-like line: fall through to toggling whole task
    // ensure we clear pending for safety (shouldn't reach here normally)
    pendingToggles.delete(pendingKey);
  }

  // Special-case Replenishment items: toggle their base status immediately
  if (task.type_id === 'Replenish') {
    status = Number(task.status_id) === 0 ? 1 : 0;
    try {
      task.status_id = status;
      if (taskToEdit.value && taskToEdit.value.id === task.id) taskToEdit.value.status_id = status;
    } catch (e) {
      // ignore
    }
    await updateTask(targetDate, task.id, { status_id: status });
    return;
  }

  // Toggle entire task status (existing behavior)
  // Handle cyclic tasks explicitly: mark occurrence done via toggleTaskComplete or undo via undoCycleDone
  try {
    if (isCyclic) {
      logger.debug('[toggleStatus] cyclic handling start', {
        taskId: task?.id,
        instanceDate: task?.date || task?.eventDate || null,
        targetDate,
        isInstance: Boolean(task?.__isCyclicInstance),
      });
      // If an occurrence is already marked done for this date, undo it
      const tAny: any = task;
      const hist = tAny.history || [];
      try {
        logger.debug('[toggleStatus] history raw:', hist);
        logger.debug(
          '[toggleStatus] history dates:',
          Array.isArray(hist) ? hist.map((hh: any) => ({ type: hh?.type, date: hh?.date })) : hist,
        );
        logger.debug('[toggleStatus] targetDate value/type:', targetDate, typeof targetDate);
      } catch (e) {
        // ignore logging errors
      }
      const alreadyDone =
        Array.isArray(hist) &&
        hist.some((h: any) => h && h.type === 'cycleDone' && h.date === targetDate);
      logger.debug('[toggleStatus] alreadyDone=', { taskId: task.id, targetDate, alreadyDone });
      if (alreadyDone) {
        const undone = await undoCycleDone(targetDate, task.id);
        if (undone) {
          logger.debug('[toggleStatus] undoCycleDone succeeded', { taskId: task.id, targetDate });
          const removeCycleDone = (obj: any) => {
            if (!obj || !Array.isArray(obj.history)) return;
            obj.history = obj.history.filter(
              (hh: any) => !(hh && hh.type === 'cycleDone' && hh.date === targetDate),
            );
          };

          try {
            removeCycleDone(task);
            const base = (allTasks.value || []).find((x: any) => x.id === task.id);
            removeCycleDone(base);
            if (taskToEdit.value && taskToEdit.value.id === task.id)
              removeCycleDone(taskToEdit.value);
            logger.debug('[toggleStatus] optimistic undo applied', {
              taskId: task.id,
              targetDate,
            });
          } catch (e) {
            logger.warn('[toggleStatus] optimistic undo failed', {
              taskId: task.id,
              targetDate,
              err: e,
            });
          }
        }
        return;
      }

      // Otherwise mark the occurrence done
      logger.debug('[toggleStatus] calling toggleTaskComplete', { taskId: task.id, targetDate });
      await toggleTaskComplete(targetDate, task.id);
      // optimistic local update so UI moves task to Done list
      try {
        const newEntry = {
          type: 'cycleDone',
          is_done: true,
          date: targetDate,
          changedAt: new Date().toISOString(),
        };
        const ensurePush = (obj: any) => {
          if (!obj) return;
          if (!Array.isArray(obj.history)) obj.history = [];
          obj.history.push(newEntry);
        };

        ensurePush(task);
        const base = (allTasks.value || []).find((x: any) => x.id === task.id);
        ensurePush(base);
        logger.debug('[toggleStatus] optimistic mark applied', { taskId: task.id, targetDate });
      } catch (e) {
        logger.warn('[toggleStatus] optimistic mark failed', {
          taskId: task.id,
          targetDate,
          err: e,
        });
      }
      return;
    }

    // reuse outer `status` (already computed) for non-cyclic toggle
  } catch (e) {
    // ignore errors when probing/recording cycleDone
    logger.warn('toggleStatus cyclic handling error', e);
  }

  const pendingKeyTask = `${task.id}:task`;
  if (pendingToggles.get(pendingKeyTask)) return;
  pendingToggles.set(pendingKeyTask, true);
  // optimistic update
  try {
    task.status_id = status;
    if (taskToEdit.value && taskToEdit.value.id === task.id) {
      taskToEdit.value.status_id = status;
    }
  } catch (e) {
    // ignore
  }
  try {
    await updateTask(targetDate, task.id, { status_id: status });
  } finally {
    pendingToggles.delete(pendingKeyTask);
  }
};

const handleFirstGroupCreation = async (data: { name: string; color: string }) => {
  const group = await addGroup({ name: data.name, color: data.color, hideTasksFromParent: false });
  defaultGroupId.value = group.id;
  activeGroup.value = {
    label: group.name,
    value: group.id,
  };
  showFirstRunDialog.value = false;
};

onMounted(async () => {
  await loadData();

  // Listen for global reload events (e.g. from MainLayout refresh button)
  // Handlers are assigned to outer-scope vars so cleanup can be registered synchronously
  organiserReloadHandler = async () => {
    try {
      await loadData();
    } catch (e) {
      // ignore
    }
    try {
      // If current active date is before today, move active day to today when refreshing
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (currentDate && currentDate.value) {
        const cur = new Date(currentDate.value);
        const today = new Date(todayStr);
        // normalize to midnight for comparison
        const curNorm = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()).getTime();
        const todayNorm = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        ).getTime();
        if (curNorm < todayNorm) {
          try {
            setCurrentDate(todayStr);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore
    }
    // bump reload key to force child components to re-render where necessary
    reloadKey.value += 1;
  };
  window.addEventListener('organiser:reloaded', organiserReloadHandler as EventListener);
  // allow header group 'manage' button to open the group dialog
  organiserGroupManageHandler = () => {
    showGroupDialog.value = true;
  };
  window.addEventListener('group:manage', organiserGroupManageHandler as EventListener);

  // Show first run dialog if no groups exist
  if (groups.value.length === 0) {
    showFirstRunDialog.value = true;
  } else {
    // Auto-select first group as active if groups exist
    const firstGroup = groups.value[0];
    if (firstGroup && !activeGroup.value) {
      activeGroup.value = {
        label: firstGroup.name,
        value: firstGroup.id,
      };
      defaultGroupId.value = firstGroup.id;
    }
  }
});
</script>

<style lang="scss" scoped src="../css/day-organiser-page.scss"></style>
