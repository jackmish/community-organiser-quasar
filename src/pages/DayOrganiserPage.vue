<template>
  <q-page class="q-pa-md">
    <!-- Active Group Selector and Type Selector -->
    <div class="row justify-between items-center q-mb-md">
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
      <div class="row q-col-gutter-md">
        <!-- Full-width Tasks Panel -->
        <div class="col-12 left-panel">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-primary row items-center justify-between">
                <q-btn
                  flat
                  dense
                  round
                  icon="chevron_left"
                  @click="prevDay"
                  color="primary"
                />
                <div class="row items-center q-gutter-md">
                  <span>
                    <span class="date-black">{{ formatDateOnly(currentDate) }}</span>
                    <span>&nbsp;|&nbsp;</span>
                    <span>{{ formatWeekday(currentDate) }}</span>
                  </span>
                  <span class="text-weight-bold">{{
                    getTimeDifferenceDisplay(currentDate)
                  }}</span>
                </div>
                <q-btn
                  flat
                  dense
                  round
                  icon="chevron_right"
                  @click="nextDay"
                  color="primary"
                />
              </div>
            </q-card-section>
            <q-card-section v-if="currentDayData.tasks.length === 0">
              <p class="text-grey-6">No tasks for this day</p>
            </q-card-section>
            <q-list v-else separator>
              <!-- Tasks with time -->
              <template v-if="tasksWithTime.length > 0">
                <q-item
                  v-for="task in tasksWithTime"
                  :key="task.id"
                  class="q-pa-md"
                  :class="{ 'bg-grey-2': task.completed }"
                >
                  <q-item-section side style="min-width: 60px">
                    <div class="text-bold text-primary">{{ task.eventTime }}</div>
                  </q-item-section>
                  <q-item-section side>
                    <q-checkbox
                      :model-value="task.completed"
                      @update:model-value="handleToggleTask(task.id)"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label :class="{ 'text-strike': task.completed }">
                      <strong>{{ task.name }}</strong>
                    </q-item-label>
                    <q-item-label caption>{{ task.description }}</q-item-label>
                    <q-item-label caption class="q-mt-xs">
                      <q-chip
                        :color="priorityColor(task.priority)"
                        text-color="white"
                        size="sm"
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
                      <q-btn
                        flat
                        round
                        dense
                        icon="delete"
                        color="negative"
                        @click="
                          openDeleteMenu = openDeleteMenu === task.id ? null : task.id
                        "
                      />
                      <div
                        v-if="openDeleteMenu === task.id"
                        class="row items-center"
                        style="gap: 8px"
                      >
                        <div>Delete?</div>
                        <q-btn
                          flat
                          dense
                          color="negative"
                          label="Yes"
                          @click="handleDeleteTask(task.id)"
                        />
                        <q-btn flat dense label="No" @click="openDeleteMenu = null" />
                      </div>
                    </div>
                  </q-item-section>
                </q-item>
              </template>

              <!-- Separator for tasks without time -->
              <q-separator
                v-if="tasksWithTime.length > 0 && tasksWithoutTime.length > 0"
                class="q-my-md"
              />
              <q-item-label
                v-if="tasksWithTime.length > 0 && tasksWithoutTime.length > 0"
                header
                class="text-grey-7"
              >
                No Time Set
              </q-item-label>

              <!-- Tasks without time -->
              <template v-if="tasksWithoutTime.length > 0">
                <q-item
                  v-for="task in tasksWithoutTime"
                  :key="task.id"
                  class="q-pa-md"
                  :class="{ 'bg-grey-2': task.completed }"
                >
                  <q-item-section side>
                    <q-checkbox
                      :model-value="task.completed"
                      @update:model-value="handleToggleTask(task.id)"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label :class="{ 'text-strike': task.completed }">
                      <strong>{{ task.name }}</strong>
                    </q-item-label>
                    <q-item-label caption>{{ task.description }}</q-item-label>
                    <q-item-label caption class="q-mt-xs">
                      <q-chip
                        :color="priorityColor(task.priority)"
                        text-color="white"
                        size="sm"
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
                      <q-btn
                        flat
                        round
                        dense
                        icon="delete"
                        color="negative"
                        @click="
                          openDeleteMenu = openDeleteMenu === task.id ? null : task.id
                        "
                      />
                      <div
                        v-if="openDeleteMenu === task.id"
                        class="row items-center"
                        style="gap: 8px"
                      >
                        <div>Delete?</div>
                        <q-btn
                          flat
                          dense
                          color="negative"
                          label="Yes"
                          @click="handleDeleteTask(task.id)"
                        />
                        <q-btn flat dense label="No" @click="openDeleteMenu = null" />
                      </div>
                    </div>
                  </q-item-section>
                </q-item>
              </template>
            </q-list>
          </q-card>
        </div>
      </div>

      <div class="row q-col-gutter-md q-mt-md">
        <div class="col-12 col-md-6">
          <CalendarView
            :selected-date="newTask.eventDate"
            @update:selected-date="handleCalendarDateSelect"
          />
        </div>
        <div class="col-12 col-md-6">
          <AddTaskForm
            :filtered-parent-options="filteredParentOptions"
            :active-group="activeGroup"
            :show-calendar="false"
            :selected-date="newTask.eventDate"
            @add-task="handleAddTask"
            @calendar-date-select="handleCalendarDateSelect"
            @filter-parent-tasks="filterParentTasks"
          />

          <!-- Notes removed per layout update -->
        </div>
      </div>
    </div>

    <!-- Group Management Dialog -->
    <q-dialog v-model="showGroupDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Manage Groups</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit.prevent="handleAddGroup" class="q-mb-md">
            <div class="row q-gutter-sm">
              <q-input
                v-model="newGroupName"
                label="Group Name"
                outlined
                dense
                class="col"
              />
              <q-select
                v-model="newGroupParent"
                :options="groupOptions"
                label="Parent Group (optional)"
                outlined
                dense
                clearable
                class="col"
              />
              <q-input
                v-model="newGroupColor"
                label="Color"
                outlined
                dense
                style="max-width: 80px"
              >
                <template #append>
                  <input
                    v-model="newGroupColor"
                    type="color"
                    style="width: 40px; height: 30px; border: none; cursor: pointer"
                  />
                </template>
              </q-input>
              <q-btn type="submit" color="primary" icon="add" dense />
            </div>
          </q-form>

          <q-tree :nodes="groupTree" node-key="id" default-expand-all>
            <template #default-header="prop">
              <div class="row items-center full-width">
                <q-icon
                  :name="prop.node.icon || 'folder'"
                  :color="prop.node.color"
                  class="q-mr-sm"
                />
                <span>{{ prop.node.label }}</span>
                <q-space />
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  size="sm"
                  @click.stop="handleDeleteGroup(prop.node.id)"
                />
              </div>
            </template>
          </q-tree>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- First Run Dialog -->
    <FirstRunDialog v-model="showFirstRunDialog" @create="handleFirstGroupCreation" />
  </q-page>
</template>

<script setup lang="ts">
import { format, addDays, startOfWeek } from "date-fns";

import AddTaskForm from "../components/AddTaskForm.vue";
import CalendarView from "../components/CalendarView.vue";

const getWeekDays = (startDate: Date) => {
  return Array.from({ length: 7 }, (_, i) => format(addDays(startDate, i), "yyyy-MM-dd"));
};

// Track which months have been shown in the calendar
const shownMonths = ref<Set<string>>(new Set());

// Helper to check if month should be shown (first day or month change, but only once)
const shouldShowMonth = (
  dayDate: string | undefined,
  index: number,
  weekDays: string[],
  isFirstWeek: boolean
) => {
  if (!dayDate) return false;

  const monthYear = format(new Date(dayDate), "yyyy-MM");

  // Reset shown months when it's the first week and first day
  if (isFirstWeek && index === 0) {
    shownMonths.value = new Set();
  }

  // Check if month has already been shown
  if (shownMonths.value.has(monthYear)) {
    return false;
  }

  // Show on first day of week
  if (index === 0) {
    shownMonths.value.add(monthYear);
    return true;
  }

  // Show when month changes from previous day within the same week
  const previousDay = weekDays[index - 1];
  if (!previousDay) return false;

  const currentMonth = new Date(dayDate).getMonth();
  const currentYear = new Date(dayDate).getFullYear();
  const previousMonth = new Date(previousDay).getMonth();
  const previousYear = new Date(previousDay).getFullYear();

  // Show if month or year changed
  if (currentMonth !== previousMonth || currentYear !== previousYear) {
    shownMonths.value.add(monthYear);
    return true;
  }

  return false;
};

// Helper to get full month name
const getMonthAbbr = (dayDate: string | undefined, index: number, weekDays: string[]) => {
  if (!dayDate) return "";
  const monthName = format(new Date(dayDate), "MMMM");

  // Add "..." prefix if this is not the first day of the month and it's the first occurrence
  const dayOfMonth = new Date(dayDate).getDate();

  // Check if this is the first day shown in the calendar (index 0 of first week)
  const isFirstDayInCalendar = index === 0;

  // Add "..." if it's the first day in calendar but not the 1st of the month
  if (isFirstDayInCalendar && dayOfMonth !== 1) {
    return `...${monthName}`;
  }

  // Add "..." if month changed from previous day but we're not on the 1st of the month
  if (index > 0) {
    const previousDay = weekDays[index - 1];
    if (previousDay) {
      const currentMonth = new Date(dayDate).getMonth();
      const previousMonth = new Date(previousDay).getMonth();
      if (currentMonth !== previousMonth && dayOfMonth !== 1) {
        return `...${monthName}`;
      }
    }
  }

  return monthName;
};

// Track which years have been shown in the calendar
const shownYears = ref<Set<string>>(new Set());

// Helper to check if year should be shown (when year changes)
const shouldShowYear = (
  dayDate: string | undefined,
  index: number,
  weekDays: string[],
  isFirstWeek: boolean
) => {
  if (!dayDate) return false;

  const year = format(new Date(dayDate), "yyyy");
  const todayYear = format(new Date(), "yyyy");

  // Reset shown years when it's the first week and first day
  if (isFirstWeek && index === 0) {
    shownYears.value = new Set();
  }

  // Check if year has already been shown
  if (shownYears.value.has(year)) {
    return false;
  }

  // Show on first day of week if it's not the current year
  if (index === 0 && year !== todayYear) {
    shownYears.value.add(year);
    return true;
  }

  // Show when year changes from previous day within the same week
  const previousDay = weekDays[index - 1];
  if (!previousDay) return false;

  const currentYear = new Date(dayDate).getFullYear();
  const previousYear = new Date(previousDay).getFullYear();

  if (currentYear !== previousYear) {
    shownYears.value.add(year);
    return true;
  }

  return false;
};

// Helper to check if day is the last day of the month
const isLastDayOfMonth = (dayDate: string | undefined) => {
  if (!dayDate) return false;
  const date = new Date(dayDate);
  const nextDay = addDays(date, 1);
  return date.getMonth() !== nextDay.getMonth();
};

// Helper to check if day is the first day of the month
const isFirstDayOfMonth = (dayDate: string | undefined) => {
  if (!dayDate) return false;
  const date = new Date(dayDate);
  return date.getDate() === 1;
};

// Helper to get week label (e.g., "1 WEEK", "2 WEEKS", "3 WEEKS")
const getWeekLabel = (dayDate: string) => {
  const date = new Date(dayDate);
  const todayDate = new Date();

  // Normalize both dates to midnight for accurate day comparison
  const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayNormalized = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate()
  );

  const daysDiff = Math.floor(
    (dateNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff > 0) {
    // Show label for exactly 365 days (1 year)
    if (daysDiff === 365) {
      return `+${daysDiff}d`;
    }

    // Show day counts for every 30 days up to 360 days
    if (daysDiff % 30 === 0 && daysDiff <= 360) {
      return `+${daysDiff}d`;
    }

    // Show week labels for multiples of 7
    if (daysDiff % 7 === 0) {
      const weeksDiff = daysDiff / 7;
      return `+${weeksDiff}w`;
    }
  }

  return null;
};

// Helper to check if a week should have margin-top (new month started in this week)
const shouldWeekHaveMargin = (
  week: string[],
  weekIndex: number,
  allWeeks: string[][]
) => {
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
  const hasDifferentMonth = previousWeek.some(
    (day) => new Date(day).getMonth() !== newMonth
  );

  return hasDifferentMonth;
};

// Helper to check if day is 1-7 of month AND month started in previous week
const isNewMonthStart = (
  day: string,
  week: string[],
  weekIndex: number,
  allWeeks: string[][]
) => {
  const dayDate = new Date(day);
  const dayOfMonth = dayDate.getDate();

  // Must be day 1-7 of the month
  if (dayOfMonth > 7) return false;

  // Check if day 1 of this month is in the current week
  const firstDayOfMonth = week.some(
    (d) => new Date(d).getDate() === 1 && new Date(d).getMonth() === dayDate.getMonth()
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
  const hasPreviousMonth = previousWeek.some(
    (d) => new Date(d).getMonth() !== currentMonth
  );

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
  if (!dayDate) return "Select a date";

  const date = new Date(dayDate);
  const todayDate = new Date();

  // Normalize both dates to midnight for accurate day comparison
  const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayNormalized = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate()
  );

  const daysDiff = Math.floor(
    (dateNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff === 0) return "TODAY";
  if (daysDiff === 1) return "TOMORROW";
  if (daysDiff === -1) return "YESTERDAY";

  if (daysDiff > 0) {
    // Future date
    const weeksDiff = Math.floor(daysDiff / 7);

    if (weeksDiff >= 1) {
      const remainingDays = daysDiff % 7;
      if (remainingDays > 0) {
        const weekText = weeksDiff === 1 ? "week" : "weeks";
        const dayText = remainingDays === 1 ? "day" : "days";
        return `In ${weeksDiff} ${weekText} ${remainingDays} ${dayText}`;
      }
      const weekText = weeksDiff === 1 ? "week" : "weeks";
      return `In ${weeksDiff} ${weekText}`;
    }

    const dayText = daysDiff === 1 ? "day" : "days";
    return `In ${daysDiff} ${dayText}`;
  } else {
    // Past date
    const absDaysDiff = Math.abs(daysDiff);
    const weeksDiff = Math.floor(absDaysDiff / 7);

    if (weeksDiff >= 1) {
      const remainingDays = absDaysDiff % 7;
      if (remainingDays > 0) {
        const weekText = weeksDiff === 1 ? "week" : "weeks";
        const dayText = remainingDays === 1 ? "day" : "days";
        return `${weeksDiff} ${weekText} ${remainingDays} ${dayText} ago`;
      }
      const weekText = weeksDiff === 1 ? "week" : "weeks";
      return `${weeksDiff} ${weekText} ago`;
    }

    const dayText = absDaysDiff === 1 ? "day" : "days";
    return `${absDaysDiff} ${dayText} ago`;
  }
};

const today = new Date();
const calendarBaseDate = ref(new Date()); // The base date for calendar display
const calendarViewDays = ref(42); // Default to 42 days view

const calendarCurrentWeek = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const val = getWeekDays(weekStart);
  console.log("[computed] calendarCurrentWeek", val);
  return val;
});
const calendarNextWeek = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const nextWeekStart = addDays(weekStart, 7);
  const val = getWeekDays(nextWeekStart);
  console.log("[computed] calendarNextWeek", val);
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

  console.log("[computed] allCalendarWeeks", weeks);
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

import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useQuasar } from "quasar";
import { useDayOrganiser } from "../modules/day-organiser";
import type { Task, TaskDuration, TaskGroup } from "../modules/day-organiser";
import FirstRunDialog from "../components/FirstRunDialog.vue";
import TaskTypeSelector from "../components/TaskTypeSelector.vue";

const $q = useQuasar();

const {
  isLoading,
  currentDate,
  currentDayData,
  loadData,
  addTask,
  deleteTask,
  toggleTaskComplete,
  updateDayNotes,
  exportData,
  importData,
  setCurrentDate,
  goToToday,
  nextDay,
  prevDay,
  groups,
  addGroup,
  deleteGroup,
  getGroupsByParent,
} = useDayOrganiser();

const fileInput = ref<HTMLInputElement | null>(null);
const showGroupDialog = ref(false);
const showFirstRunDialog = ref(false);
const newGroupName = ref("");
const newGroupParent = ref<string | undefined>(undefined);
const newGroupColor = ref("#1976d2");
const defaultGroupId = ref<string | undefined>(undefined);
const activeGroup = ref<{ label: string; value: string | null } | null>(null);
const openDeleteMenu = ref<string | null>(null);

// Refs for date inputs
const dayInput = ref<any>(null);
const monthInput = ref<any>(null);
const yearInput = ref<any>(null);
const hourInput = ref<any>(null);
const minuteInput = ref<any>(null);
const autoIncrementYear = ref(true);
const timeType = ref<"wholeDay" | "exactHour">("wholeDay");
const isUpdatingDate = ref(false);
const isClickBlocked = ref(false);

// Computed properties for separate date inputs
const eventDateYear = computed(() => {
  const dateStr = newTask.value.eventDate;
  let val;
  if (!dateStr) val = new Date().getFullYear();
  else {
    const parts = dateStr.split("-");
    val = parseInt(parts[0] || "0", 10);
  }
  console.log("[computed] eventDateYear", val);
  return val;
});

const eventDateMonth = computed(() => {
  const dateStr = newTask.value.eventDate;
  let val;
  if (!dateStr) val = new Date().getMonth() + 1;
  else {
    const parts = dateStr.split("-");
    val = parseInt(parts[1] || "0", 10);
  }
  console.log("[computed] eventDateMonth", val);
  return val;
});

const eventDateDay = computed(() => {
  const dateStr = newTask.value.eventDate;
  let val;
  if (!dateStr) val = new Date().getDate();
  else {
    const parts = dateStr.split("-");
    val = parseInt(parts[2] || "0", 10);
  }
  console.log("[computed] eventDateDay", val);
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
    const newDate = format(new Date(year, month - 1, day), "yyyy-MM-dd");
    newTask.value.eventDate = newDate;

    // Sync calendar view only if the date is not visible in current view
    const allVisibleDays = allCalendarWeeks.value.flat();
    if (!allVisibleDays.includes(newDate)) {
      calendarBaseDate.value = new Date(year, month - 1, day);
    }

    // Auto-focus to hour input after filling month (when month is 2 digits)
    if (String(value).length >= 2) {
      setTimeout(() => {
        hourInput.value?.$el?.querySelector("input")?.focus();
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
    const newDate = format(new Date(year, month - 1, day), "yyyy-MM-dd");
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
    const newDate = format(new Date(year, month - 1, day), "yyyy-MM-dd");
    newTask.value.eventDate = newDate;

    // Sync calendar view only if the date is not visible in current view
    const allVisibleDays = allCalendarWeeks.value.flat();
    if (!allVisibleDays.includes(newDate)) {
      calendarBaseDate.value = new Date(year, month - 1, day);
    }

    // Auto-focus to month input after filling day (when day is 2 digits)
    if (String(value).length >= 2) {
      setTimeout(() => {
        monthInput.value?.$el?.querySelector("input")?.focus();
      }, 0);
    }
  } finally {
    isUpdatingDate.value = false;
  }
};

// Time inputs
const eventTimeHour = computed(() => {
  if (!newTask.value.eventTime) return "";
  const val = Number(newTask.value.eventTime.split(":")[0]);
  console.log("[computed] eventTimeHour", val);
  return val;
});

const eventTimeMinute = computed(() => {
  if (!newTask.value.eventTime) return "";
  const val = Number(newTask.value.eventTime.split(":")[1]);
  console.log("[computed] eventTimeMinute", val);
  return val;
});

const updateEventTimeHour = (value: string | number | null) => {
  if (value === null || value === "") return;
  const hour = Number(value);
  if (hour < 0 || hour > 23) return;

  // Automatically switch to "Exact Hour" when user enters hour
  timeType.value = "exactHour";

  const minute = eventTimeMinute.value || 0;
  newTask.value.eventTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}`;

  // Auto-focus to minute input after filling hour (when hour is 2 digits)
  if (String(value).length >= 2) {
    setTimeout(() => {
      minuteInput.value?.$el?.querySelector("input")?.focus();
    }, 0);
  }
};

const updateEventTimeMinute = (value: string | number | null) => {
  if (value === null || value === "") return;
  const minute = Number(value);
  if (minute < 0 || minute > 59) return;

  // Automatically switch to "Exact Hour" when user enters minute
  timeType.value = "exactHour";

  const hour = eventTimeHour.value || 0;
  newTask.value.eventTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}`;
};

// Watch timeType to clear time when "Whole Day" is selected
watch(timeType, (newValue) => {
  if (newValue === "wholeDay") {
    newTask.value.eventTime = "";
  }
});

const newTask = ref({
  name: "",
  description: "",
  type_id: "TimeEvent",
  status_id: "",
  parent_id: null as string | null,
  created_by: "",
  priority: "medium" as Task["priority"],
  completed: false,
  groupId: undefined as string | undefined,
  eventDate: format(new Date(), "yyyy-MM-dd"),
  eventTime: "",
});

const typeOptions = [
  { label: "Command center", value: "Command center", icon: "dashboard" },
  { label: "Note/Later", value: "Note/Later", icon: "note" },
  { label: "TimeEvent", value: "TimeEvent", icon: "event" },
  { label: "Replenishment", value: "Replenishment", icon: "shopping_cart" },
];

const priorityOptions = [
  {
    label: "Lo",
    value: "low",
    icon: "low_priority",
    color: "cyan-3",
    textColor: "grey-9",
  },
  {
    label: "Med",
    value: "medium",
    icon: "drag_handle",
    color: "brown-7",
    textColor: "white",
  },
  {
    label: "Hi",
    value: "high",
    icon: "priority_high",
    color: "orange",
    textColor: "white",
  },
  {
    label: "Crit",
    value: "critical",
    icon: "warning",
    color: "negative",
    textColor: "white",
  },
];

const parentTaskOptions = computed(() => {
  const val = currentDayData.value.tasks.map((task) => ({
    label: task.name,
    value: task.id,
    icon: typeOptions.find((t) => t.value === task.category)?.icon || "task",
  }));
  console.log("[computed] parentTaskOptions", val);
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
    if (val === "") {
      filteredParentOptions.value = parentTaskOptions.value;
    } else {
      const needle = val.toLowerCase();
      filteredParentOptions.value = parentTaskOptions.value.filter(
        (option) => option.label.toLowerCase().indexOf(needle) > -1
      );
    }
  });
};

const sortedTasks = computed(() => {
  // Filter tasks by active group (unless "All Groups" is selected)
  let tasksToSort = currentDayData.value.tasks;
  if (activeGroup.value && activeGroup.value.value !== null) {
    tasksToSort = tasksToSort.filter((task) => task.groupId === activeGroup.value!.value);
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
  console.log("[computed] sortedTasks", val);
  return val;
});

// Group tasks by whether they have time
const tasksWithTime = computed(() => {
  const val = sortedTasks.value.filter((t) => !!t.eventTime);
  console.log("[computed] tasksWithTime", val);
  return val;
});
const tasksWithoutTime = computed(() => {
  const val = sortedTasks.value.filter((t) => !t.eventTime);
  console.log("[computed] tasksWithoutTime", val);
  return val;
});

// Group options for select
const groupOptions = computed(() => {
  const val = groups.value.map((g) => ({
    label: g.name,
    value: g.id,
  }));
  console.log("[computed] groupOptions", val);
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

  console.log("[computed] activeGroupOptions", options);
  return options;
});

// Build group tree for display
const groupTree = computed(() => {
  const buildTree = (parentId?: string): any[] => {
    return getGroupsByParent(parentId).map((group) => ({
      id: group.id,
      label: group.name,
      color: group.color,
      icon: "folder",
      children: buildTree(group.id),
    }));
  };
  const val = buildTree();
  console.log("[computed] groupTree", val);
  return val;
});

const formatDisplayDate = (date: string) => {
  const dateObj = new Date(date);
  const weekday = dateObj.toLocaleDateString("en-US", { weekday: "long" });
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString("en-US", { month: "long" });
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year} | ${weekday}`;
};

// Return just the date portion (e.g., "22 December 2025")
const formatDateOnly = (date: string) => {
  const dateObj = new Date(date);
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString("en-US", { month: "long" });
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year}`;
};

// Return weekday (e.g., "Monday")
const formatWeekday = (date: string) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString("en-US", { weekday: "long" });
};

const priorityColor = (priority: Task["priority"]) => {
  const colors = {
    low: "cyan-3",
    medium: "brown-7",
    high: "orange",
    critical: "negative",
  };
  return colors[priority];
};

const getGroupName = (groupId: string): string => {
  const group = groups.value.find((g) => g.id === groupId);
  return group ? group.name : "Unknown";
};

const getGroupColor = (groupId: string): string => {
  const group = groups.value.find((g) => g.id === groupId);
  return group?.color || "#1976d2";
};

const handleAddTask = async (taskPayload: any) => {
  // Check if active group is selected (and not "All Groups")
  if (!activeGroup.value || activeGroup.value.value === null) {
    $q.notify({
      type: "warning",
      message: 'Please select an active group first (not "All Groups")',
      position: "top",
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

const handleDeleteTask = async (taskId: string) => {
  await deleteTask(currentDate.value, taskId);
  openDeleteMenu.value = null;
};

const handleToggleTask = async (taskId: string) => {
  await toggleTaskComplete(currentDate.value, taskId);
};

const handleActiveGroupChange = (
  value: { label: string; value: string | null } | null
) => {
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
      console.error("Import failed:", error);
    }
  }
};

const handleAddGroup = async () => {
  if (!newGroupName.value.trim()) return;

  const group = await addGroup(
    newGroupName.value,
    newGroupParent.value,
    newGroupColor.value
  );

  // Set as default and active if it's the first group
  if (!defaultGroupId.value) {
    defaultGroupId.value = group.id;
    activeGroup.value = {
      label: group.name,
      value: group.id,
    };
  }

  // Reset form
  newGroupName.value = "";
  newGroupParent.value = undefined;
  newGroupColor.value = "#1976d2";
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
    const dataFile = window.electronAPI.joinPath(appDataPath, "organiser-data.json");

    $q.dialog({
      title: "Data Storage Location",
      message: `Your data is automatically saved to:\n\n${dataFile}`,
      html: true,
      ok: {
        label: "Close",
        color: "primary",
      },
    });
  } else {
    $q.notify({
      message: "Running in web mode - data is stored in browser localStorage",
      color: "info",
      position: "top",
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
