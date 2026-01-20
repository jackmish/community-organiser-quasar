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
                  <div style="margin-left: 12px; display: inline-block">
                    <div
                      class="header-today"
                      style="
                        display: inline-block;
                        font-size: 0.9rem;
                        background: #ffffff;
                        color: #212121;
                        padding: 6px 10px;
                        border-radius: 6px;
                        align-items: center;
                      "
                    >
                      <div
                        class="text-caption"
                        style="color: #424242; margin-right: 6px; display: inline-block"
                      >
                        <span style="color: #757575; font-weight: 700"
                          >{{ currentDateWeekday }},&nbsp;</span
                        >
                        <span style="color: #1976d2; font-weight: 700">{{ currentDateShort }}</span>
                      </div>
                      <div
                        class="text-caption"
                        style="color: #424242; display: inline-block; margin-left: 6px"
                      >
                        |&nbsp;<span style="color: #2e7d32; font-weight: 700">{{
                          currentTimeDisplay
                        }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- group select moved to main header -->
                </div>
              </div>
            </q-card-section>
            <q-card-section v-if="sortedTasks.length === 0">
              <p class="text-grey-6">No tasks for this day</p>
            </q-card-section>
            <TasksList
              :key="reloadKey"
              :tasks-with-time="tasksWithTime"
              :tasks-without-time="tasksWithoutTime"
              :selected-task-id="selectedTaskId"
              @task-click="handleTaskClick"
              @toggle-status="toggleStatus"
              @edit-task="editTask"
              @delete-task="handleDeleteTask"
            />
          </q-card>
        </div>
        <!-- Right column for Replenishment list -->
        <div class="col-12 replenish-column">
          <ReplenishmentList
            :replenish-tasks="replenishTasks"
            @toggle-status="toggleStatus"
            @edit-task="editTask"
          />
          <div class="q-mt-sm">
            <DoneTasksList :done-tasks="doneTasks" @toggle-status="toggleStatus" />
          </div>
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

    <!-- Fixed right-side panel: ModeSwitcher above preview/form -->
    <div :class="['fixed-right-panel', { 'panel-hidden': panelHidden }]">
      <!-- Hide button visible when panel is open -->
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
import { format, addDays, startOfWeek } from 'date-fns';

import AddTaskForm from '../components/AddTaskForm.vue';
import ReplenishmentList from '../components/ReplenishmentList.vue';
import DoneTasksList from '../components/DoneTasksList.vue';
import GroupManagementDialog from '../components/GroupManagementDialog.vue';
import TasksList from '../components/TasksList.vue';
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  priorityDefinitions as themePriorityDefinitions,
  timeDiffClassFor,
  formatDisplayDate,
  formatEventHoursDiff,
  findReplenishSet,
  getReplenishBg as themeGetReplenishBg,
  getReplenishText as themeGetReplenishText,
} from '../components/theme';
import TaskPreview from '../components/TaskPreview.vue';
import CalendarView from '../components/CalendarView.vue';
import { useLongPress } from '../composables/useLongPress';

const getWeekDays = (startDate: Date) => {
  return Array.from({ length: 7 }, (_, i) => format(addDays(startDate, i), 'yyyy-MM-dd'));
};

// (calendar month/year display helpers removed — CalendarView handles these)

// Helper to check if a week should have margin-top (new month started in this week)
const shouldWeekHaveMargin = (week: string[], weekIndex: number, allWeeks: string[][]) => {
  if (weekIndex === 0) return false; // First week never has margin

  // Check if this week contains the 1st of a month
  const hasFirstOfMonth = week.some((day) => new Date(day).getDate() === 1);
  if (!hasFirstOfMonth) return false;

  // Get the previous week
  const previousWeek = allWeeks[weekIndex - 1];
  if (!previousWeek) return false;

  // Check if the previous week has any day from a different month than the 1st in current week
  const firstDayOfMonth = week.find((day) => new Date(day).getDate() === 1);
  if (!firstDayOfMonth) return false;

  const newMonth = new Date(firstDayOfMonth).getMonth();

  // If any day in previous week is from a different month, add margin
  const hasDifferentMonth = previousWeek.some((day) => new Date(day).getMonth() !== newMonth);

  return hasDifferentMonth;
};

// Helper to check if day is 1-7 of month AND month started in previous week
const isNewMonthStart = (day: string, week: string[], weekIndex: number, allWeeks: string[][]) => {
  const dayDate = new Date(day);
  const dayOfMonth = dayDate.getDate();

  // Must be day 1-7 of the month
  if (dayOfMonth > 7) return false;

  // Check if day 1 of this month is in the current week
  const firstDayOfMonth = week.some(
    (d) => new Date(d).getDate() === 1 && new Date(d).getMonth() === dayDate.getMonth(),
  );

  // Only apply padding if day 1 is in THIS week (not in a previous week)
  if (!firstDayOfMonth) return false;

  // Check if this is the first week (no previous week)
  if (weekIndex === 0) {
    // Only apply if day 1 is not the first day of the week
    return week.indexOf(day) > 0;
  }

  // Check if previous week has days from a different month
  const previousWeek = allWeeks[weekIndex - 1];
  if (!previousWeek) return false;

  const currentMonth = dayDate.getMonth();
  const hasPreviousMonth = previousWeek.some((d) => new Date(d).getMonth() !== currentMonth);

  return hasPreviousMonth;
};

// Helper to check if day comes after the 1st in the same row
const isAfterFirstInRow = (day: string, week: string[]) => {
  const dayIndex = week.indexOf(day);
  if (dayIndex === -1) return false;

  // Check if there's a day 1 before this day in the same week
  for (let i = 0; i < dayIndex; i++) {
    const currentDay = week[i];
    if (currentDay && new Date(currentDay).getDate() === 1) {
      return true;
    }
  }

  return false;
};

// Helper to get time difference display for the year input area
const getTimeDifferenceDisplay = (dayDate: string) => {
  if (!dayDate) return 'Select a date';

  const date = new Date(dayDate);
  const todayDate = new Date();

  // Normalize both dates to midnight for accurate day comparison
  const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayNormalized = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate(),
  );

  const daysDiff = Math.floor(
    (dateNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysDiff === 0) return 'TODAY';
  if (daysDiff === 1) return 'TOMORROW';
  if (daysDiff === -1) return 'YESTERDAY';

  if (daysDiff > 0) {
    // Future date
    const weeksDiff = Math.floor(daysDiff / 7);

    if (weeksDiff >= 1) {
      const remainingDays = daysDiff % 7;
      if (remainingDays > 0) {
        const weekText = weeksDiff === 1 ? 'week' : 'weeks';
        const dayText = remainingDays === 1 ? 'day' : 'days';
        return `In ${weeksDiff} ${weekText} ${remainingDays} ${dayText}`;
      }
      const weekText = weeksDiff === 1 ? 'week' : 'weeks';
      return `In ${weeksDiff} ${weekText}`;
    }

    const dayText = daysDiff === 1 ? 'day' : 'days';
    return `In ${daysDiff} ${dayText}`;
  } else {
    // Past date
    const absDaysDiff = Math.abs(daysDiff);
    const weeksDiff = Math.floor(absDaysDiff / 7);

    if (weeksDiff >= 1) {
      const remainingDays = absDaysDiff % 7;
      if (remainingDays > 0) {
        const weekText = weeksDiff === 1 ? 'week' : 'weeks';
        const dayText = remainingDays === 1 ? 'day' : 'days';
        return `${weeksDiff} ${weekText} ${remainingDays} ${dayText} ago`;
      }
      const weekText = weeksDiff === 1 ? 'week' : 'weeks';
      return `${weeksDiff} ${weekText} ago`;
    }

    const dayText = absDaysDiff === 1 ? 'day' : 'days';
    return `${absDaysDiff} ${dayText} ago`;
  }
};

// Return a CSS class for the time-diff label: delegate to shared helper
const getTimeDiffClass = (dayDate: string) => timeDiffClassFor(getTimeDifferenceDisplay(dayDate));

// Return a short display for hours difference when a task has exact time
const getEventHoursDisplay = (task: any) => {
  const dateStr = task?.date || task?.eventDate || '';
  const timeStr = task?.eventTime || '';
  return formatEventHoursDiff(dateStr, timeStr);
};

const today = new Date();
const calendarBaseDate = ref(new Date()); // The base date for calendar display
const calendarViewDays = ref(42); // Default to 42 days view

const calendarCurrentWeek = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const val = getWeekDays(weekStart);
  return val;
});

// Current clock for top-right display
const now = ref(new Date());
let clockTimer: any = null;
onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
});
onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
});

const currentDateDisplay = computed(() => {
  return format(now.value, 'EEEE, dd.MM.yyyy');
});
const currentDateWeekday = computed(() => format(now.value, 'EEEE'));
const currentDateShort = computed(() => format(now.value, 'dd.MM.yyyy'));
const currentTimeDisplay = computed(() => {
  return format(now.value, 'HH:mm');
});
const calendarNextWeek = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const nextWeekStart = addDays(weekStart, 7);
  const val = getWeekDays(nextWeekStart);
  return val;
});

// Generate all visible weeks based on selected view
const allCalendarWeeks = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const numWeeks = calendarViewDays.value / 7;
  const weeks = [];

  for (let i = 0; i < numWeeks; i++) {
    const weekStartDate = addDays(weekStart, i * 7);
    weeks.push(getWeekDays(weekStartDate));
  }

  return weeks;
});

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
import type { Task, TaskDuration, TaskGroup } from '../modules/day-organiser';
import FirstRunDialog from '../components/FirstRunDialog.vue';
import { occursOnDay, getCycleType } from 'src/utils/occursOnDay';
import TaskTypeSelector from '../components/TaskTypeSelector.vue';

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
  updateDayNotes,
  exportData,
  importData,
  getTasksInRange,
  setCurrentDate,
  goToToday,
  nextDay,
  prevDay,
  groups,
  activeGroup,
  addGroup,
  deleteGroup,
  getGroupsByParent,
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

const fileInput = ref<HTMLInputElement | null>(null);
const showGroupDialog = ref(false);
const groupMenu = ref(false);
const groupMenuBtn = ref<any>(null);
const showEditGroupDialog = ref(false);
const editGroupLocal = ref<{
  id: string;
  name: string;
  parentId?: string | null;
  color?: string;
} | null>(null);
const showFirstRunDialog = ref(false);
const newGroupName = ref('');
const newGroupParent = ref<string | undefined>(undefined);
const newGroupColor = ref('#1976d2');
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
// pending promises for child line animation events
const pendingLineEvents = new Map<string, (payload?: any) => void>();

function waitForLineEvent(
  taskId: string | number | undefined,
  idx: number,
  type: 'collapsed' | 'expanded',
) {
  if (!taskId && taskId !== 0) return Promise.resolve();
  const key = `${taskId}:${idx}:${type}`;
  return new Promise<void>((res) => {
    pendingLineEvents.set(key, () => res());
  });
}

function onLineCollapsed(payload: any) {
  try {
    const key = `${payload.taskId}:${payload.idx}:collapsed`;
    const fn = pendingLineEvents.get(key);
    if (fn) {
      fn(payload);
      pendingLineEvents.delete(key);
    }
  } catch (e) {
    // ignore
  }
}

function onLineExpanded(payload: any) {
  try {
    const key = `${payload.taskId}:${payload.idx}:expanded`;
    const fn = pendingLineEvents.get(key);
    if (fn) {
      fn(payload);
      pendingLineEvents.delete(key);
    }
  } catch (e) {
    // ignore
  }
}

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

function openEditGroup(g: TaskGroup) {
  editGroupLocal.value = {
    id: g.id,
    name: g.name,
    parentId: (g as any).parentId ?? (g as any).parent_id ?? null,
    color: g.color || '#1976d2',
  };
  showEditGroupDialog.value = true;
  groupMenu.value = false;
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
const dayInput = ref<any>(null);
const monthInput = ref<any>(null);
const yearInput = ref<any>(null);
const hourInput = ref<any>(null);
const minuteInput = ref<any>(null);
const autoIncrementYear = ref(true);
const timeType = ref<'wholeDay' | 'exactHour'>('wholeDay');
const isUpdatingDate = ref(false);
const isClickBlocked = ref(false);
// Long-press handling via composable
const { startLongPress, cancelLongPress, longPressTriggered, setLongPressHandler } = useLongPress();

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

function handleReplenishClick(task: Task) {
  if (longPressTriggered.value) {
    longPressTriggered.value = false;
    return;
  }
  toggleStatus(task);
}

// Computed properties for separate date inputs
const eventDateYear = computed(() => {
  const dateStr = newTask.value.eventDate;
  let val;
  if (!dateStr) val = new Date().getFullYear();
  else {
    const parts = dateStr.split('-');
    val = parseInt(parts[0] || '0', 10);
  }
  return val;
});

const eventDateMonth = computed(() => {
  const dateStr = newTask.value.eventDate;
  let val;
  if (!dateStr) val = new Date().getMonth() + 1;
  else {
    const parts = dateStr.split('-');
    val = parseInt(parts[1] || '0', 10);
  }
  return val;
});

const eventDateDay = computed(() => {
  const dateStr = newTask.value.eventDate;
  let val;
  if (!dateStr) val = new Date().getDate();
  else {
    const parts = dateStr.split('-');
    val = parseInt(parts[2] || '0', 10);
  }
  return val;
});

// Update functions for separate date inputs
const updateEventDateMonth = (value: string | number | null) => {
  if (!value || isUpdatingDate.value) return;
  isUpdatingDate.value = true;

  try {
    const month = Number(value);
    if (month < 1 || month > 12) return;

    let year = eventDateYear.value;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Auto-adjust year if enabled
    if (autoIncrementYear.value) {
      const yearDifference = year - currentYear;

      if (month >= currentMonth) {
        // If month is same or higher, set to current year
        year = currentYear;
      } else if (yearDifference <= 1) {
        // If month is lower and year difference is 1 or less, increment by 1
        year = currentYear + 1;
      }
      // Otherwise keep the year as is (if difference > 1)
    }

    const day = eventDateDay.value;
    const newDate = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
    newTask.value.eventDate = newDate;

    // Sync calendar view only if the date is not visible in current view
    const allVisibleDays = allCalendarWeeks.value.flat();
    if (!allVisibleDays.includes(newDate)) {
      calendarBaseDate.value = new Date(year, month - 1, day);
    }

    // Auto-focus to hour input after filling month (when month is 2 digits)
    if (String(value).length >= 2) {
      setTimeout(() => {
        hourInput.value?.$el?.querySelector('input')?.focus();
      }, 0);
    }
  } finally {
    isUpdatingDate.value = false;
  }
};

const updateEventDateYear = (value: string | number | null) => {
  if (!value || isUpdatingDate.value) return;
  isUpdatingDate.value = true;

  try {
    const year = Number(value);
    const month = eventDateMonth.value;
    const day = eventDateDay.value;
    const newDate = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
    newTask.value.eventDate = newDate;

    // Sync calendar view only if the date is not visible in current view
    const allVisibleDays = allCalendarWeeks.value.flat();
    if (!allVisibleDays.includes(newDate)) {
      calendarBaseDate.value = new Date(year, month - 1, day);
    }
  } finally {
    isUpdatingDate.value = false;
  }
};

const updateEventDateDay = (value: string | number | null) => {
  if (!value || isUpdatingDate.value) return;
  isUpdatingDate.value = true;

  try {
    const day = Number(value);
    if (day < 1 || day > 31) return;
    const year = eventDateYear.value;
    const month = eventDateMonth.value;
    const newDate = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
    newTask.value.eventDate = newDate;

    // Sync calendar view only if the date is not visible in current view
    const allVisibleDays = allCalendarWeeks.value.flat();
    if (!allVisibleDays.includes(newDate)) {
      calendarBaseDate.value = new Date(year, month - 1, day);
    }

    // Auto-focus to month input after filling day (when day is 2 digits)
    if (String(value).length >= 2) {
      setTimeout(() => {
        monthInput.value?.$el?.querySelector('input')?.focus();
      }, 0);
    }
  } finally {
    isUpdatingDate.value = false;
  }
};

// Time inputs
const eventTimeHour = computed(() => {
  if (!newTask.value.eventTime) return '';
  const val = Number(newTask.value.eventTime.split(':')[0]);
  return val;
});

const eventTimeMinute = computed(() => {
  if (!newTask.value.eventTime) return '';
  const val = Number(newTask.value.eventTime.split(':')[1]);
  return val;
});

const updateEventTimeHour = (value: string | number | null) => {
  if (value === null || value === '') return;
  const hour = Number(value);
  if (hour < 0 || hour > 23) return;

  // Automatically switch to "Exact Hour" when user enters hour
  timeType.value = 'exactHour';

  const minute = eventTimeMinute.value || 0;
  newTask.value.eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  // Auto-focus to minute input after filling hour (when hour is 2 digits)
  if (String(value).length >= 2) {
    setTimeout(() => {
      minuteInput.value?.$el?.querySelector('input')?.focus();
    }, 0);
  }
};

const updateEventTimeMinute = (value: string | number | null) => {
  if (value === null || value === '') return;
  const minute = Number(value);
  if (minute < 0 || minute > 59) return;

  // Automatically switch to "Exact Hour" when user enters minute
  timeType.value = 'exactHour';

  const hour = eventTimeHour.value || 0;
  newTask.value.eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

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

const priorityOptions = [
  {
    label: 'Lo',
    value: 'low',
    icon: 'low_priority',
    color: themePriorityColors.low,
    textColor: themePriorityTextColor('low'),
  },
  {
    label: 'Med',
    value: 'medium',
    icon: 'drag_handle',
    color: themePriorityColors.medium,
    textColor: themePriorityTextColor('medium'),
  },
  {
    label: 'Hi',
    value: 'high',
    icon: 'priority_high',
    color: themePriorityColors.high,
    textColor: themePriorityTextColor('high'),
  },
  {
    label: 'Crit',
    value: 'critical',
    icon: 'warning',
    color: themePriorityColors.critical,
    textColor: themePriorityTextColor('critical'),
  },
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
  if (activeGroup.value && activeGroup.value.value !== null) {
    tasksToSort = tasksToSort.filter((task) => task.groupId === activeGroup.value!.value);
  }

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
          tasksToSort.push(clone);
        }
      }
    }
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
      val = val.filter((t) => t.groupId === activeGroup.value!.value);
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
      replenishDone = replenishDone.filter((t: any) => t.groupId === activeGroup.value!.value);
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
    const key = (g as any).parentId ?? (g as any).parent_id ?? '__root__';
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
    console.log('Building tree for parentId=', pidNorm);
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

// Return weekday (e.g., "Monday")
const formatWeekday = (date: string) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', { weekday: 'long' });
};

const priorityColor = (priority: Task['priority']) => themePriorityColors[priority];
const priorityTextColor = (priority: Task['priority']) => themePriorityTextColor(priority);

const getGroupName = (groupId?: string): string => {
  if (!groupId) return 'Unknown';
  const group = groups.value.find((g) => g.id === groupId);
  return group ? group.name : 'Unknown';
};

const getGroupColor = (groupId?: string): string => {
  if (!groupId) return '#1976d2';
  const group = groups.value.find((g) => g.id === groupId);
  return group?.color || '#1976d2';
};

// Replenish colors and helpers live in the shared theme
const getReplenishBg = (task: any) => themeGetReplenishBg(task.color_set);
const getReplenishText = (task: any) => themeGetReplenishText(task.color_set);

const setReplenishColor = async (task: any, colorId: string | null) => {
  // For generated cyclic instances prefer the instance's eventDate (or current view)
  const targetDate =
    task && task.__isCyclicInstance
      ? task.eventDate || currentDate.value
      : task.date || task.eventDate || currentDate.value;
  try {
    // optimistic UI
    task.color_set = colorId;
    if (taskToEdit.value && taskToEdit.value.id === task.id) taskToEdit.value.color_set = colorId;
    await updateTask(targetDate, task.id, { color_set: colorId });
  } catch (e) {
    logger.error('Failed to set replenish color', e);
  }
};

const getDisplayDescription = (task: Task): string => {
  const desc = (task.description || '').trim();
  const name = (task.name || '').trim();
  if (!desc) return '';
  if (!name) return desc;

  // If description equals the name exactly, hide it
  if (desc === name) return '';

  // If description starts with the name followed by separators, strip the leading name
  if (desc.startsWith(name)) {
    const remainder = desc
      .slice(name.length)
      .replace(/^[\s\-:\u2013\u2014]+/, '')
      .trim();
    return remainder || '';
  }

  return desc;
};

const handleAddTask = async (taskPayload: any, opts?: { preview?: boolean }) => {
  // Check if active group is selected (and not "All Groups")
  if (!activeGroup.value || activeGroup.value.value === null) {
    $q.notify({
      type: 'warning',
      message: 'Please select an active group first (not "All Groups")',
      position: 'top',
    });
    return;
  }

  // Validate payload
  if (!taskPayload || !taskPayload.name) return;

  // Build task data and add to the currently displayed day
  const taskData: any = {
    ...taskPayload,
    date: currentDate.value,
    groupId: activeGroup.value.value,
  };

  const created = await addTask(currentDate.value, taskData);
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

const handleActiveGroupChange = (value: { label: string; value: string | null } | null) => {
  activeGroup.value = value;
};

const handleUpdateNotes = async (notes: string | number | null) => {
  if (notes !== null && notes !== undefined) {
    await updateDayNotes(currentDate.value, String(notes));
  }
};

const handleExport = () => {
  exportData();
};

const handleImport = () => {
  fileInput.value?.click();
};

const onFileSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    try {
      await importData(file);
    } catch (error) {
      logger.error('Import failed:', error);
    }
  }
};

const handleAddGroup = async () => {
  if (!newGroupName.value.trim()) return;

  const group = await addGroup(newGroupName.value, newGroupParent.value, newGroupColor.value);

  // Set as default and active if it's the first group
  if (!defaultGroupId.value) {
    defaultGroupId.value = group.id;
    activeGroup.value = {
      label: group.name,
      value: group.id,
    };
  }

  // Reset form
  newGroupName.value = '';
  newGroupParent.value = undefined;
  newGroupColor.value = '#1976d2';
};

const handleFirstGroupCreation = async (data: { name: string; color: string }) => {
  const group = await addGroup(data.name, undefined, data.color);
  defaultGroupId.value = group.id;
  activeGroup.value = {
    label: group.name,
    value: group.id,
  };
  showFirstRunDialog.value = false;
};

const handleDeleteGroup = async (groupId: string) => {
  await deleteGroup(groupId);

  // If deleted group was the active one, set a new active group
  if (activeGroup.value?.value === groupId) {
    if (groups.value.length > 0) {
      const firstGroup = groups.value[0];
      if (firstGroup) {
        activeGroup.value = {
          label: firstGroup.name,
          value: firstGroup.id,
        };
        defaultGroupId.value = firstGroup.id;
      }
    } else {
      activeGroup.value = null;
      defaultGroupId.value = undefined;
    }
  }

  // If deleted group was the default, set a new default
  if (defaultGroupId.value === groupId && groups.value.length > 0) {
    defaultGroupId.value = groups.value[0]?.id;
  } else if (groups.value.length === 0) {
    defaultGroupId.value = undefined;
  }
};

const showDataLocation = async () => {
  if (window.electronAPI) {
    const appDataPath = await window.electronAPI.getAppDataPath();
    const dataFile = window.electronAPI.joinPath(appDataPath, 'organiser-data.json');

    $q.dialog({
      title: 'Data Storage Location',
      message: `Your data is automatically saved to:\n\n${dataFile}`,
      html: true,
      ok: {
        label: 'Close',
        color: 'primary',
      },
    });
  } else {
    $q.notify({
      message: 'Running in web mode - data is stored in browser localStorage',
      color: 'info',
      position: 'top',
    });
  }
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

<style scoped>
.selected-task {
  border: 2px solid var(--q-primary, #1976d2);
  border-radius: 6px;
  background-color: rgba(25, 118, 210, 0.06);
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.06);
}

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

/* styling for the tasks container card to match AddTaskForm/preview style */
.task-list-card {
  /* dark blue per request */
  background-color: #0d47a1;
}

/* header styling to contrast with the green background */
.task-list-header {
  color: #ffffff; /* primary header text: white */
  background-color: #1976d2; /* blue header background only */
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
  width: 100%;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

/* Right-aligned wrapper for the group select inside the header */
.task-list-header .group-select-wrapper {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  margin-right: 0; /* keep inside header padding */
}

.task-list-header .group-select-wrapper .q-field {
  min-width: 220px;
  max-width: 320px;
  height: 36px !important; /* compact fixed height */
  display: flex !important;
  align-items: center !important;
}

/* Ensure any internal row spacing doesn't push controls down */
.task-list-header .row.items-center.justify-between {
  margin-top: 0 !important;
  align-items: center !important;
  width: 100%;
}

.task-list-header .group-select-wrapper .q-field,
.task-list-header .group-select-wrapper .q-btn {
  margin-top: 0 !important;
  align-self: center !important;
}

/* Ensure select control contents are vertically centered */
.task-list-header .group-select-wrapper .q-field__control {
  display: flex !important;
  align-items: center !important;
  height: 100% !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

/* Make the header's inner row span full width so justify-between pushes the group wrapper to the right edge */
.task-list-header > .row.items-center.justify-between {
  width: 100%;
}

/* Hide the floating label so the field height stays compact */
.task-list-header .group-select-wrapper .q-field__label {
  display: none !important;
}

/* Compact the selected value/control vertically */
.task-list-header .group-select-wrapper input,
.task-list-header .group-select-wrapper textarea,
.task-list-header .group-select-wrapper .q-select__input {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

/* ensure arrow buttons/icons in the header are visible on blue */
.task-list-header .q-btn,
.task-list-header .q-btn .q-icon {
  color: #ffffff !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* make date text a light blue for contrast */
.task-list-card .task-list-header .date-black {
  color: #bbdefb !important; /* light blue for header date (force override) */
}

/* allow the time-diff bold element to remain white */
.task-list-header .text-weight-bold {
  color: #ffffff;
}

/* time-diff helper classes returned by theme.timeDiffClassFor() */
.time-diff-white {
  color: #ffffff !important;
}
.time-diff-lightblue {
  color: #bbdefb !important;
}
.time-diff-default {
  color: rgba(255, 255, 255, 0.85) !important;
}

.replenish-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 8px;
}
.replenish-item {
  cursor: pointer;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.6);
  padding: 8px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-card,
.replenish-item {
  position: relative;
}

/* Floating Add button styles */
.floating-add-btn {
  position: fixed;
  right: 0px;
  bottom: 0px;
  z-index: 1900 !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
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

.done-item {
  /* Keep done tasks readable: very light desaturation */
  filter: grayscale(10%);
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
}

/* Layout helpers to let the replenish column size automatically */
.tasks-row {
  align-items: flex-start;
}
.tasks-column {
  flex: 1 1 0;
}
.replenish-column {
  flex: 0 0 auto;
  width: auto;
  /* keep it from growing too large on wide screens */
  max-width: 420px;
  min-width: 220px;
}

@media (max-width: 767px) {
  .replenish-column {
    max-width: 100%;
    min-width: 0;
  }
}
</style>

<style scoped>
.calendar-table {
  width: 100%;
  border-collapse: collapse;
}

.calendar-table th {
  padding: 8px 4px;
  text-align: center;
}

.calendar-cell {
  padding: 4px;
  text-align: center;
  vertical-align: top;
}

.calendar-day-btn {
  white-space: normal !important;
  width: calc(100% - 8px);
  margin: 0 auto;
}

.calendar-day-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.calendar-day-number {
  font-size: 1.3em;
  font-weight: 500;
}

.calendar-today-label {
  font-size: 0.9em;
  color: white;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.calendar-week-label {
  font-size: 0.9em;
  color: white;
  font-weight: normal;
  letter-spacing: 0.5px;
  text-transform: none !important;
}

.calendar-green-label {
  color: black !important;
  background-color: white;
  padding: 2px 6px;
  border-radius: 4px;
}

.calendar-year-label-above {
  font-size: 0.75em;
  color: #1976d2;
  font-weight: bold;
  letter-spacing: 0.5px;
  text-align: center;
  min-height: 14px;
}

.calendar-month-label-above {
  font-size: 1.2em;
  color: #1976d2;
  font-weight: bold;
  letter-spacing: 0.5px;
  text-align: center;
  min-height: 20px;
}

.calendar-year-inline {
  font-size: 0.75em;
  margin-left: 6px;
}

.first-day-of-month {
  border-left: 5px solid #1976d2 !important;
  border-top: 5px solid #1976d2 !important;
}

.after-first-in-row {
  border-top: 5px solid #1976d2 !important;
}

.new-month-start {
  padding-top: 48px;
}

.date-black {
  color: black !important;
}

.fixed-right-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1600;
  width: 360px;
  max-width: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  gap: 0px;
  align-items: flex-end;
  /* ensure the panel sits flush on the bottom-right when anchored */
  border-bottom-right-radius: 0 !important;
  /* also remove bottom-left and top-right rounding per user request */
  border-bottom-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
  /* constrain panel height so it never exceeds the viewport */
  max-height: calc(100vh - 32px);
}
.fixed-right-panel .fixed-content {
  width: 100%;
  /* make content scrollable when the panel is taller than the viewport */
  overflow-y: auto;
  max-height: calc(100vh - 120px);
  -webkit-overflow-scrolling: touch;
}

.fixed-right-panel .panel-toggle-btn {
  position: absolute;
  top: -36px;
  right: 8px;
  z-index: 1700;
  padding: 10px 14px;
  font-weight: 600;
  color: #fff !important;
  /* background: #37d !important; */
  background: #356 !important;

  border-radius: 8px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
}

/* Show button visible when the panel is hidden: fixed at bottom-right */
.panel-show-btn {
  position: fixed;
  /* move left so it doesn't sit under the floating add button */
  right: 50px;
  bottom: 0px;
  z-index: 1800;
  padding: 10px 16px;
  background: #579 !important;
  color: #fff !important;
  border-radius: 10px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
  font-weight: 600;
}

/* move panel below viewport when hidden */
.fixed-right-panel.panel-hidden {
  transform: translateY(calc(100% + 24px));
  transition: transform 320ms ease-in-out;
}
.fixed-right-panel {
  transition: transform 320ms ease-in-out;
}
.fixed-right-panel > .row {
  margin-bottom: -4px;
}
.floating-add-btn {
  position: fixed;
  right: 0px;
  bottom: 0px;
  z-index: 1900 !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  /* remove any bottom-right rounding so it sits flush with the viewport corner */
  border-bottom-right-radius: 0 !important;
  /* also remove bottom-left and top-right rounding */
  border-bottom-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
}
</style>
