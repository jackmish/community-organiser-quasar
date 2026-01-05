<template>
  <q-page class="q-pa-md">
    <!-- Active Group Selector and Type Selector -->
    <div class="row justify-between items-center q-mb-md">
      <div class="row items-center" style="gap: 12px">
        <q-select
          v-model="activeGroup"
          :options="activeGroupOptions"
          label="Active Group"
          outlined
          dense
          style="min-width: 300px"
          @update:model-value="handleActiveGroupChange"
          :rules="[(val) => !!val || 'Please select an active group']"
        >
          <template #prepend>
            <q-icon name="folder_open" />
          </template>
        </q-select>
      </div>

      <TaskTypeSelector
        :model-value="newTask.type_id"
        @update:model-value="
          (value) => {
            if (newTask.type_id !== value) newTask.type_id = value;
          }
        "
      />
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center q-pa-lg">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Day View -->
    <div v-else>
      <div class="row q-col-gutter-md tasks-row">
        <!-- Tasks column (left) and Replenishment column (right) -->
        <div class="col-12 left-panel tasks-column">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-primary">
                <div
                  class="row items-center justify-between"
                  style="align-items: center; margin-top: 6px"
                >
                  <div class="row items-center" style="gap: 8px">
                    <q-btn flat dense round icon="chevron_left" @click="prevDay" color="primary" />
                    <span :class="['text-weight-bold', getTimeDiffClass(currentDate)]">{{
                      getTimeDifferenceDisplay(currentDate)
                    }}</span>
                    <span class="q-mx-sm">|</span>
                    <span class="date-black">{{ formatDateOnly(currentDate) }}</span>
                    <q-btn flat dense round icon="chevron_right" @click="nextDay" color="primary" />
                  </div>
                </div>
              </div>
            </q-card-section>
            <q-card-section v-if="sortedTasks.length === 0">
              <p class="text-grey-6">No tasks for this day</p>
            </q-card-section>
            <TasksList
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
            :selected-date="newTask.eventDate"
            :tasks="allTasks"
            @update:selected-date="handleCalendarDateSelect"
            @preview-task="setPreviewTask"
          />
        </div>
        <div class="col-12 col-md-4">
          <div class="q-mb-sm">
            <ModeSwitcher v-model="mode" :allowed-modes="allowedModes" />
          </div>

          <!-- Replenishment items are rendered with other tasks (no separate right-column panel) -->

          <div v-if="mode === 'preview' && taskToEdit">
            <TaskPreview
              :task="taskToEdit"
              :group-name="getGroupName(taskToEdit.groupId)"
              @edit="
                () => {
                  mode = 'edit';
                }
              "
              @close="clearTaskToEdit"
              @toggle-status="(t, i) => toggleStatus(t, i)"
            />
          </div>
          <div v-else>
            <AddTaskForm
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
              @replenish-restore="handleReplenishRestore"
              @cancel-edit="() => clearTaskToEdit()"
              @calendar-date-select="handleCalendarDateSelect"
              @filter-parent-tasks="filterParentTasks"
            />
          </div>

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

    <!-- First Run Dialog -->
    <FirstRunDialog v-model="showFirstRunDialog" @create="handleFirstGroupCreation" />
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
  timeDiffClassFor,
  formatDisplayDate,
  formatEventHoursDiff,
} from '../components/theme';
import TaskPreview from '../components/TaskPreview.vue';
import ModeSwitcher from '../components/ModeSwitcher.vue';
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

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useQuasar } from 'quasar';
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
  addGroup,
  deleteGroup,
  getGroupsByParent,
  previewTaskId,
  setPreviewTask,
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
const showFirstRunDialog = ref(false);
const newGroupName = ref('');
const newGroupParent = ref<string | undefined>(undefined);
const newGroupColor = ref('#1976d2');
const defaultGroupId = ref<string | undefined>(undefined);
const activeGroup = ref<{ label: string; value: string | null } | null>(null);
const openDeleteMenu = ref<string | null>(null);
const taskToEdit = ref<Task | null>(null);
const mode = ref<'add' | 'edit' | 'preview'>('add');
const selectedTaskId = ref<string | null>(null);

// Allowed modes depend on whether a task is selected
const allowedModes = computed(() => (taskToEdit.value ? ['add', 'edit', 'preview'] : ['add']));

// Ensure we return to 'add' mode when no task is selected
watch(taskToEdit, (val) => {
  if (!val && mode.value !== 'add') {
    mode.value = 'add';
  }
});

function setTaskToEdit(task: Task) {
  taskToEdit.value = task;
  // show preview when a task is clicked
  mode.value = 'preview';
  selectedTaskId.value = task.id;
}

function editTask(task: Task) {
  taskToEdit.value = task;
  mode.value = 'edit';
  selectedTaskId.value = task.id;
}

function clearTaskToEdit() {
  taskToEdit.value = null;
  mode.value = 'add';
  selectedTaskId.value = null;
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
      taskToEdit.value = found;
      mode.value = 'preview';
      selectedTaskId.value = found.id;
      // also ensure the calendar/date syncs to the task date
      try {
        setCurrentDate(found.date || found.eventDate || null);
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
    }
  } catch (err) {
    // Ignore: if getTasksInRange isn't available or fails, fall back to just today's tasks
    console.warn('Failed to include Todo extras for today', err);
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

// Handler to restore a Replenish task to undone status
const handleReplenishRestore = async (taskId: string) => {
  if (!taskId) return;
  // Find the task across all tasks
  const tasks = allTasks?.value || [];
  const t = tasks.find((x: any) => x.id === taskId);
  if (!t) return;
  const targetDate = t.date || t.eventDate || currentDate.value;
  try {
    await updateTask(targetDate, taskId, { status_id: 1 });
    // If currently in preview/edit mode, ensure the UI refreshes
    taskToEdit.value = null;
  } catch (e) {
    console.error('Failed to restore replenish task', e);
  }
};

// Group tasks by whether they have time
const replenishTasks = computed(() => {
  // only show replenish tasks that are not done
  const val = sortedTasks.value.filter(
    (t) => t.type_id === 'Replenish' && Number(t.status_id) !== 0,
  );
  return val;
});

// Tasks that are marked done (status_id === 0) - newest completed first
const doneTasks = computed(() => {
  const done = sortedTasks.value.filter((t) => Number(t.status_id) === 0);
  return [...done].sort((a, b) => {
    const getTime = (task: any) => {
      // prefer updatedAt, then createdAt, then fallback to 0
      const ts = task.updatedAt ?? task.createdAt ?? task.updated_at ?? task.created_at ?? null;
      return ts ? new Date(ts).getTime() : 0;
    };
    return getTime(b) - getTime(a);
  });
});

const tasksWithTime = computed(() => {
  const val = sortedTasks.value.filter(
    (t) => !!t.eventTime && t.type_id !== 'Replenish' && Number(t.status_id) !== 0,
  );
  return val;
});
const tasksWithoutTime = computed(() => {
  const val = sortedTasks.value.filter(
    (t) => !t.eventTime && t.type_id !== 'Replenish' && Number(t.status_id) !== 0,
  );
  return val;
});

// Group options for select
const groupOptions = computed(() => {
  const val = groups.value.map((g) => ({
    label: g.name,
    value: g.id,
  }));
  return val;
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
        value: g.id,
      };
    }),
  ];

  return options;
});

// Build group tree for display
const groupTree = computed(() => {
  const buildTree = (parentId?: string): any[] => {
    return getGroupsByParent(parentId).map((group) => ({
      id: group.id,
      label: group.name,
      color: group.color,
      icon: 'folder',
      children: buildTree(group.id),
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

// Replenish color sets grouped by family (4 tones each), ordered dark->bright
const replenishColorSets = [
  // Reds (dark -> bright) - removed 2nd swatch
  { id: 'set-1', bg: '#b71c1c', text: '#ffffff' },
  { id: 'set-4', bg: '#ff5252', text: '#000000' },
  { id: 'set-3', bg: '#ff8a80', text: '#000000' },
  // Yellows (dark -> bright) - removed 2nd swatch
  { id: 'set-5', bg: '#fdd835', text: '#000000' },
  { id: 'set-8', bg: '#ffeb3b', text: '#000000' },
  { id: 'set-6', bg: '#fff176', text: '#000000' },
  // Greens (dark -> bright) - removed 2nd swatch
  { id: 'set-9', bg: '#2e7d32', text: '#ffffff' },
  { id: 'set-11', bg: '#9ccc65', text: '#000000' },
  { id: 'set-12', bg: '#a5d6a7', text: '#000000' },
  // Azures / Cyans (dark -> bright) - removed 2nd swatch
  { id: 'set-13', bg: '#00acc1', text: '#ffffff' },
  { id: 'set-15', bg: '#80deea', text: '#000000' },
  { id: 'set-16', bg: '#b2ebf2', text: '#000000' },
  // Blues (dark -> bright) - removed 2nd swatch
  { id: 'set-17', bg: '#0d47a1', text: '#ffffff' },
  { id: 'set-18', bg: '#1976d2', text: '#ffffff' },
  { id: 'set-20', bg: '#90caf9', text: '#000000' },
  // Violets (dark -> bright) - removed 2nd swatch
  { id: 'set-21', bg: '#6a1b9a', text: '#ffffff' },
  { id: 'set-23', bg: '#ab47bc', text: '#ffffff' },
  { id: 'set-24', bg: '#ce93d8', text: '#000000' },
  // Black / Gray / White (dark -> bright) - removed 2nd swatch
  { id: 'set-25', bg: '#000000', text: '#ffffff' },
  { id: 'set-27', bg: '#9e9e9e', text: '#000000' },
  { id: 'set-28', bg: '#ffffff', text: '#000000' },
];

const findColorSet = (id?: string | null) => {
  if (!id) return null;
  return replenishColorSets.find((s) => s.id === id) || null;
};

const getReplenishBg = (task: any) => {
  const s = findColorSet(task.color_set);
  return s ? s.bg : 'transparent';
};

const getReplenishText = (task: any) => {
  const s = findColorSet(task.color_set);
  return s ? s.text : 'inherit';
};

const setReplenishColor = async (task: any, colorId: string | null) => {
  const targetDate = task.date || task.eventDate || currentDate.value;
  try {
    // optimistic UI
    task.color_set = colorId;
    if (taskToEdit.value && taskToEdit.value.id === task.id) taskToEdit.value.color_set = colorId;
    await updateTask(targetDate, task.id, { color_set: colorId });
  } catch (e) {
    console.error('Failed to set replenish color', e);
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

const handleAddTask = async (taskPayload: any) => {
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

  await addTask(currentDate.value, taskData);
};

const handleUpdateTask = async (updatedTask: any) => {
  if (!updatedTask || !updatedTask.id) return;
  const { id, ...rest } = updatedTask;
  // Determine which date bucket the task belongs to: prefer explicit `date`, then `eventDate`, otherwise current view
  const targetDate =
    (updatedTask.date as string) || (updatedTask.eventDate as string) || currentDate.value;
  await updateTask(targetDate, id, rest);
  taskToEdit.value = null;
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
  } finally {
    openDeleteMenu.value = null;
  }
};

const toggleStatus = async (task: any, lineIndex?: number) => {
  // If a line index is provided, toggle only that line's checked marker inside the description
  if (typeof lineIndex === 'number' && task && typeof task.description === 'string') {
    const lines = task.description.split(/\r?\n/);
    const ln = lines[lineIndex] ?? '';

    const dashMatch = ln.match(/^(\s*-\s*)(\[[xX]\]\s*)?(.*)$/);
    const numMatch = ln.match(/^(\s*\d+[.)]\s*)(\[[xX]\]\s*)?(.*)$/);

    if (dashMatch) {
      const prefix = dashMatch[1];
      const marker = dashMatch[2] || '';
      const content = dashMatch[3] || '';
      const checked = /^\s*\[[xX]\]\s*/.test(marker);
      if (checked) {
        // remove marker
        lines[lineIndex] = `${prefix}${content}`;
      } else {
        // add marker after the dash prefix
        lines[lineIndex] = `${prefix}[x] ${content}`;
      }
      const newDesc = lines.join('\n');
      // optimistic update so UI reflects change immediately
      try {
        task.description = newDesc;
        if (taskToEdit.value && taskToEdit.value.id === task.id) {
          taskToEdit.value.description = newDesc;
        }
      } catch (e) {
        // ignore
      }
      const targetDate = task.date || task.eventDate || currentDate.value;
      await updateTask(targetDate, task.id, { description: newDesc });
      return;
    }

    if (numMatch) {
      const prefix = numMatch[1];
      const marker = numMatch[2] || '';
      const content = numMatch[3] || '';
      const checked = /^\s*\[[xX]\]\s*/.test(marker);
      if (checked) {
        lines[lineIndex] = `${prefix}${content}`;
      } else {
        lines[lineIndex] = `${prefix}[x] ${content}`;
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
      const targetDate = task.date || task.eventDate || currentDate.value;
      await updateTask(targetDate, task.id, { description: newDesc });
      return;
    }
    // Not a list-like line: fall through to toggling whole task
  }

  // Toggle entire task status (existing behavior)
  const status = Number(task.status_id) === 0 ? 1 : 0;
  // optimistic update
  try {
    task.status_id = status;
    if (taskToEdit.value && taskToEdit.value.id === task.id) {
      taskToEdit.value.status_id = status;
    }
  } catch (e) {
    // ignore
  }
  const targetDate = task.date || task.eventDate || currentDate.value;
  await updateTask(targetDate, task.id, { status_id: status });
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
      console.error('Import failed:', error);
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
  filter: grayscale(100%);
  opacity: 0.55;
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
  width: 100%;
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
</style>
