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
import { createTaskUiHandlers, createTaskViewHelpers } from 'src/modules/task/uiHandlers';
import { createCalendarHandlers } from 'src/modules/task/calendarHandlers';
import { createTaskComputed } from 'src/modules/task/computedTaskLists';
import { createTaskCrudHandlers } from 'src/modules/task/taskCrudHandlers';

// Use shared view composable for clock and time-diff helpers
const { now, getTimeDifferenceDisplay, getTimeDiffClass } = useDayOrganiserView();

// calendar handlers will be provided by createCalendarHandlers (instantiated after refs)

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import logger from 'src/utils/logger';
import { useDayOrganiser } from '../modules/day-organiser';
import type { Task, TaskGroup } from '../modules/day-organiser';
import FirstRunDialog from '../components/FirstRunDialog.vue';
import { occursOnDay, getCycleType } from 'src/utils/occursOnDay';
import { createGroupUiHandlers } from 'src/modules/group/uiHandlers';
import { isVisibleForActive as groupIsVisible } from 'src/modules/group/groupUtils';

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
  updateGroup,

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
const { waitForLineEvent, onLineCollapsed, onLineExpanded } = createLineEventHandlers();

// task UI handlers moved to module
const { setTaskToEdit, editTask, clearTaskToEdit } = createTaskUiHandlers({
  taskToEdit,
  mode,
  panelHidden,
  selectedTaskId,
  currentDate,
  setCurrentDate,
});

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

// Ensure we return to 'add' mode when no task is selected
watch(taskToEdit, (val) => {
  if (!val && mode.value !== 'add') {
    mode.value = 'add';
  }
});

const { saveEditedGroup, cancelEditGroup } = createGroupUiHandlers({
  editGroupLocal,
  showEditGroupDialog,
  updateGroup,
});

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

// calendar preview handled by createCalendarHandlers

const {
  isClickBlocked,
  newTask,

  filteredParentOptions,
  handleTaskClick,
  filterParentTasks,
  parseYmdLocal,
  getTimeOffsetDaysForTask,
} = createTaskViewHelpers({
  currentDate,
  setCurrentDate,
  currentDayData,
  allTasks,
  groups,
  activeGroup,
  getGroupsByParent,
  setTaskToEdit,
  editTask,
});

// instantiate calendar handlers (safe: uses refs created above)
const { handleCalendarDateSelect, handleCalendarEdit, handleCalendarPreview } =
  createCalendarHandlers({
    isClickBlocked,
    newTask,
    setCurrentDate,
    allTasks,
    editTask,
    setTaskToEdit,
    mode,
    selectedTaskId,
    setPreviewTask,
    notify: (opts: any) => $q.notify(opts),
  });

// compute task lists in a separate module for reuse and testability
const {
  sortedTasks,
  replenishTasks,
  doneTasks,
  tasksWithTime,
  tasksWithoutTime,
  groupOptions,
  activeGroupOptions,
  groupTree,
} = createTaskComputed({
  currentDayData,
  currentDate,
  allTasks,
  getTasksInRange,
  groups,
  activeGroup,
  getGroupsByParent,
  parseYmdLocal,
  getTimeOffsetDaysForTask,
  getCycleType,
  occursOnDay,
  groupIsVisible,
});

// group options, activeGroupOptions and groupTree are provided by createTaskComputed

// Return weekday and compact date (e.g., "Tuesday, 23.12.2025")
const formatDateOnly = (date: string) => formatDisplayDate(date);

const getGroupName = (groupId?: string): string => {
  if (!groupId) return 'Unknown';
  const group = groups.value.find((g) => g.id === groupId);
  return group ? group.name : 'Unknown';
};

// Extract add/update handlers into a task CRUD module
const { handleAddTask, handleUpdateTask } = createTaskCrudHandlers({
  setCurrentDate,
  activeGroup,
  currentDate,
  allTasks,
  quasar: $q,
  taskToEdit,
  mode,
  selectedTaskId,
});

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
