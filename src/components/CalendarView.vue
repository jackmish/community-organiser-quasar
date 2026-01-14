<template>
  <div>
    <!-- Quick Date Buttons and Next button (moved to top) -->
    <div class="row q-gutter-sm q-mt-md q-mb-lg items-center">
      <div class="col-auto">
        <q-btn
          unelevated
          icon="chevron_left"
          label="Prev"
          color="primary"
          text-color="white"
          @click="previousCalendarWeeks"
          size="sm"
        />
      </div>
      <div class="col text-right">
        <q-btn
          unelevated
          size="md"
          color="blue"
          text-color="white"
          @click="setEventDateToToday"
          class="text-weight-bold today-jump-btn"
          style="font-size: 16px"
        >
          TODAY
        </q-btn>
        <q-btn
          v-for="(month, index) in nextSixMonths"
          :key="month.value"
          unelevated
          size="md"
          :color="['blue', 'purple', 'orange', 'teal', 'pink', 'indigo'][index]"
          text-color="white"
          @click="jumpToMonth(month.value)"
          :class="['text-weight-bold', { 'first-month-btn': index === 0 }]"
          style="font-size: 16px"
        >
          {{ String(new Date(month.value).getMonth() + 1).padStart(2, '0') }}.{{
            month.label.toUpperCase()
          }}{{ index === 0 ? ' ' + month.value.slice(0, 4) : '' }}
        </q-btn>
      </div>
    </div>
    <div class="row items-center">
      <div class="col">
        <table class="calendar-table">
          <thead>
            <tr>
              <th
                v-for="day in calendarCurrentWeek"
                :key="'header-' + day"
                class="text-center text-weight-bold text-caption text-grey-7"
              >
                {{ ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date(day).getDay()] }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(week, weekIndex) in allCalendarWeeks"
              :key="'week-' + weekIndex"
              :class="{
                'new-month-week': shouldWeekHaveMargin(week, weekIndex, allCalendarWeeks),
              }"
            >
              <td v-for="(day, index) in week" :key="day" class="calendar-cell">
                <div
                  :class="{
                    'new-month-start': isNewMonthStart(day, week, weekIndex, allCalendarWeeks),
                  }"
                >
                  <div
                    v-if="
                      shouldShowMonth(day, index, week, weekIndex === 0) ||
                      shouldShowYear(day, index, week, weekIndex === 0)
                    "
                    class="calendar-month-label-above"
                  >
                    <span>
                      {{ getMonthAbbr(day, index, week) }}
                    </span>
                    <span
                      v-if="
                        shouldShowYear(day, index, week, weekIndex === 0) ||
                        new Date(day).getFullYear() !== new Date().getFullYear()
                      "
                      class="calendar-year-inline"
                    >
                      {{ new Date(day).getFullYear() }}
                    </span>
                  </div>
                  <div v-else class="calendar-month-label-above">&nbsp;</div>
                </div>
                <q-btn
                  size="sm"
                  :color="
                    day === selectedDate
                      ? 'primary'
                      : day < format(new Date(), 'yyyy-MM-dd')
                        ? 'grey-5'
                        : 'grey-7'
                  "
                  @click="handleDateSelect(day)"
                  :title="
                    new Date(day).toLocaleDateString('en-US', {
                      weekday: 'long',
                    })
                  "
                  :class="[
                    'calendar-day-btn',
                    { 'first-day-of-month': isFirstDayOfMonth(day) },
                    {
                      'after-first-in-row': isAfterFirstInRow(day, week),
                    },
                    { 'calendar-weekend': isWeekend(day) },
                    { 'calendar-holiday': !!getHoliday(day) },
                    { 'calendar-today': day === format(new Date(), 'yyyy-MM-dd') },
                    { 'calendar-selected': day === selectedDate },
                  ]"
                >
                  <div class="calendar-day-content">
                    <div class="calendar-top">
                      <div class="calendar-day-number">
                        {{ new Date(day).getDate() }}
                      </div>
                      <div
                        v-if="day === format(new Date(), 'yyyy-MM-dd')"
                        class="calendar-today-label calendar-green-label"
                      >
                        TODAY
                      </div>
                      <div
                        v-else-if="day === format(addDays(new Date(), -1), 'yyyy-MM-dd')"
                        class="calendar-today-label"
                      >
                        YESTERDAY
                      </div>
                      <div
                        v-else-if="day === format(addDays(new Date(), 1), 'yyyy-MM-dd')"
                        class="calendar-today-label calendar-gray-label"
                      >
                        TOMORROW
                      </div>
                      <div v-else-if="getHoliday(day)" class="calendar-holiday-label">
                        {{ getHoliday(day)?.localName }}
                      </div>
                      <div v-else-if="getWeekLabel(day)" class="calendar-week-label">
                        {{ getWeekLabel(day) }}
                      </div>
                    </div>
                    <!-- Render events for this day (including cyclic repeats) -->
                    <div class="calendar-events">
                      <template v-if="props.tasks && props.tasks.length">
                        <div
                          v-for="ev in getEventsForDay(day)"
                          :key="ev.id + '-' + (ev.eventTime || '')"
                          class="calendar-event-pill q-pa-xs"
                          :title="ev.name + (ev.eventTime ? ' • ' + ev.eventTime : '')"
                          :style="{
                            backgroundColor: themePriorityColors[ev.priority] || '#888',
                            color: themePriorityTextColor
                              ? themePriorityTextColor(ev.priority)
                              : '#fff',
                          }"
                        >
                          <span
                            class="event-time"
                            v-if="ev.eventTime"
                            @pointerdown="() => startLongPress(ev)"
                            @pointerup="() => onEventPointerUp(ev)"
                            @pointercancel="cancelLongPress"
                            @pointerleave="cancelLongPress"
                          >
                            {{ ev.eventTime }}
                          </span>
                          <span
                            class="event-title"
                            @pointerdown="() => startLongPress(ev)"
                            @pointerup="() => onEventPointerUp(ev)"
                            @pointercancel="cancelLongPress"
                            @pointerleave="cancelLongPress"
                          >
                            {{ ev.name }}
                          </span>
                        </div>
                      </template>
                    </div>
                  </div>
                </q-btn>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- Prev button and visible days per page option (moved to bottom) -->
    <div class="row q-mb-md items-center">
      <div class="col">
        <div class="row items-center q-gutter-md">
          <div class="text-subtitle2">Calendar View</div>
          <q-option-group
            v-model="calendarViewDays"
            :options="[
              { label: '14 days', value: 14 },
              { label: '42 days', value: 42 },
              { label: '3 months', value: 84 },
            ]"
            color="primary"
            inline
            dense
            size="xs"
          />
        </div>
      </div>
      <div class="col text-right">
        <q-btn
          unelevated
          icon-right="chevron_right"
          label="Next"
          color="primary"
          text-color="white"
          @click="nextCalendarWeeks"
          size="sm"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import logger from 'src/utils/logger';
import { useLongPress } from '../composables/useLongPress';
import { occursOnDay } from 'src/utils/occursOnDay';
import { format, addDays, startOfWeek } from 'date-fns';
import {
  priorityColors as themePriorityColors,
  priorityDefinitions as themePriorityDefinitions,
  priorityTextColor as themePriorityTextColor,
} from './theme';

const props = defineProps<{
  selectedDate?: string;
  // Optional list of tasks so the calendar can render events
  tasks?: Array<any>;
}>();

const emit = defineEmits<{
  (e: 'update:selectedDate', value: string): void;
  (e: 'preview-task', payload: any): void;
  (e: 'edit-task', id: string | null): void;
}>();

// Long-press composable for event pills
const { startLongPress, cancelLongPress, setLongPressHandler, longPressTriggered } = useLongPress();

// Long-press should open edit mode; short press shows preview.
setLongPressHandler((task: any) => {
  try {
    emit('edit-task', task?.id ?? null);
  } catch (e) {
    // ignore
  }
});

function onEventPointerUp(task: any) {
  try {
    // If long-press wasn't triggered, treat as a short click -> preview
    if (!longPressTriggered.value) {
      // Emit the full task/event object (includes `date` when coming from getEventsForDay)
      emit('preview-task', task ?? null);
    }
  } catch (e) {
    // ignore
  } finally {
    cancelLongPress();
  }
}

const calendarBaseDate = ref(new Date());
const calendarViewDays = ref(42);

// Manager to handle month/year display state (keeps internal mutable sets
// outside of render-time reactive mutations to avoid recursive updates)
class CalendarDisplayManager {
  shownMonths: Set<string>;
  shownYears: Set<string>;

  constructor() {
    this.shownMonths = new Set();
    this.shownYears = new Set();
  }

  reset() {
    this.shownMonths = new Set();
    this.shownYears = new Set();
  }

  shouldShowMonth(day: string, index: number, week: string[], isFirstWeek: boolean) {
    const date = new Date(day);
    const monthYear = format(date, 'yyyy-MM');

    if (isFirstWeek && index === 0) {
      this.shownMonths = new Set();
    }

    if (this.shownMonths.has(monthYear)) return false;

    if (index === 0) {
      this.shownMonths.add(monthYear);
      return true;
    }

    const previousDay = week[index - 1];
    if (!previousDay) return false;

    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    const previousMonth = new Date(previousDay).getMonth();
    const previousYear = new Date(previousDay).getFullYear();

    if (currentMonth !== previousMonth || currentYear !== previousYear) {
      this.shownMonths.add(monthYear);
      return true;
    }

    return false;
  }

  shouldShowYear(day: string, index: number, week: string[], isFirstWeek: boolean) {
    const date = new Date(day);
    const year = format(date, 'yyyy');
    const todayYear = format(new Date(), 'yyyy');

    if (isFirstWeek && index === 0) {
      this.shownYears = new Set();
    }

    if (this.shownYears.has(year)) return false;

    if (index === 0 && year !== todayYear) {
      this.shownYears.add(year);
      return true;
    }

    const previousDay = week[index - 1];
    if (!previousDay) return false;

    const currentYear = date.getFullYear();
    const previousYear = new Date(previousDay).getFullYear();

    if (currentYear !== previousYear) {
      this.shownYears.add(year);
      return true;
    }

    return false;
  }
}

const displayManager = new CalendarDisplayManager();

// themePriorityColors imported from shared theme

// Reset manager when calendar base or view size changes
watch([calendarBaseDate, calendarViewDays], () => displayManager.reset());

// Online/offline detection
const isOnline = ref(navigator.onLine);

// Holidays state
interface Holiday {
  date: string;
  localName: string;
  name: string;
}

interface HolidayCache {
  year: number;
  holidays: Holiday[];
  fetchedAt: number;
}

const holidays = ref<Map<string, Holiday>>(new Map());

// Check if running in Electron
const isElectron = !!(window as any).electronAPI;

// Get holidays file path
async function getHolidaysFilePath(year: number): Promise<string | null> {
  if (!isElectron) return null;

  const appDataPath = await (window as any).electronAPI.getAppDataPath();
  return (window as any).electronAPI.joinPath(appDataPath, 'holidays', `holidays_PL_${year}.json`);
}

// Load holidays from APPDATA (Electron) or localStorage (browser)
async function loadHolidaysFromCache(year: number): Promise<boolean> {
  try {
    if (isElectron) {
      // Load from APPDATA file
      const filePath = await getHolidaysFilePath(year);
      if (!filePath) return false;

      const exists = await (window as any).electronAPI.fileExists(filePath);
      if (!exists) return false;

      const data: HolidayCache = await (window as any).electronAPI.readJsonFile(filePath);

      // Load holidays into Map (no expiry check for APPDATA files)
      data.holidays.forEach((holiday) => {
        holidays.value.set(holiday.date, holiday);
      });

      return true;
    } else {
      // Load from localStorage
      const cacheKey = `holidays_PL_${year}`;
      const cached = localStorage.getItem(cacheKey);

      if (!cached) return false;

      const data: HolidayCache = JSON.parse(cached);

      // Check if cache is still valid (less than 30 days old)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const isExpired = Date.now() - data.fetchedAt > thirtyDaysMs;

      if (isExpired) {
        localStorage.removeItem(cacheKey);
        return false;
      }

      // Load holidays into Map
      data.holidays.forEach((holiday) => {
        holidays.value.set(holiday.date, holiday);
      });

      return true;
    }
  } catch (error) {
    logger.error('Failed to load holidays from cache:', error);
    return false;
  }
}

// Save holidays to APPDATA (Electron) or localStorage (browser)
async function saveHolidaysToCache(year: number, holidayList: Holiday[]) {
  try {
    const cache: HolidayCache = {
      year,
      holidays: holidayList,
      fetchedAt: Date.now(),
    };

    if (isElectron) {
      // Save to APPDATA file
      const filePath = await getHolidaysFilePath(year);
      if (!filePath) return;

      // Ensure directory exists
      const dirPath = (window as any).electronAPI.joinPath(
        await (window as any).electronAPI.getAppDataPath(),
        'holidays',
      );
      await (window as any).electronAPI.ensureDir(dirPath);

      // Write file (serialize to plain JSON first to avoid structured-clone errors
      // when crossing the contextBridge boundary)
      const safe = JSON.parse(JSON.stringify(cache));
      await (window as any).electronAPI.writeJsonFile(filePath, safe);
      logger.log(`Saved holidays for ${year} to APPDATA`);
    } else {
      // Save to localStorage
      const cacheKey = `holidays_PL_${year}`;
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    }
  } catch (error) {
    logger.error('Failed to save holidays to cache:', error);
  }
}

// Fetch holidays for Poland from API
async function fetchHolidays(year: number) {
  // Try to load from cache first
  const loaded = await loadHolidaysFromCache(year);
  if (loaded) {
    return;
  }

  // In Electron, don't connect to API - just use fallback
  if (isElectron) {
    loadFallbackHolidays(year);
    // Save fallback to cache for next time
    const fallbackList = Array.from(holidays.value.values()).filter((h) =>
      h.date.startsWith(`${year}-`),
    );
    await saveHolidaysToCache(year, fallbackList);
    return;
  }

  // In browser, fetch from API if not in cache
  try {
    // Use XMLHttpRequest instead of fetch to avoid QUIC protocol issues in Electron
    const data: Holiday[] = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 5000;
      xhr.open('GET', `https://date.nager.at/api/v3/PublicHolidays/${year}/PL`);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('Failed to parse JSON'));
          }
        } else {
          reject(new Error(`HTTP error! status: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Request timeout'));
      xhr.send();
    });

    // Store holidays in Map for quick lookup
    data.forEach((holiday) => {
      holidays.value.set(holiday.date, holiday);
    });

    // Save to cache
    await saveHolidaysToCache(year, data);
  } catch (error) {
    logger.warn(`Failed to fetch holidays for ${year}, using fallback:`, error);
    // Load fallback holidays
    loadFallbackHolidays(year);
  }
}

// Fallback Polish holidays (major ones that don't change)
function loadFallbackHolidays(year: number) {
  const fallbackHolidays: Holiday[] = [
    { date: `${year}-01-01`, localName: 'Nowy Rok', name: "New Year's Day" },
    { date: `${year}-01-06`, localName: 'Trzech Króli', name: 'Epiphany' },
    { date: `${year}-05-01`, localName: 'Święto Pracy', name: 'Labour Day' },
    {
      date: `${year}-05-03`,
      localName: 'Święto Konstytucji 3 Maja',
      name: 'Constitution Day',
    },
    {
      date: `${year}-08-15`,
      localName: 'Wniebowzięcie Najświętszej Maryi Panny',
      name: 'Assumption of Mary',
    },
    { date: `${year}-11-01`, localName: 'Wszystkich Świętych', name: "All Saints' Day" },
    {
      date: `${year}-11-11`,
      localName: 'Narodowe Święto Niepodległości',
      name: 'Independence Day',
    },
    { date: `${year}-12-25`, localName: 'Boże Narodzenie', name: 'Christmas Day' },
    {
      date: `${year}-12-26`,
      localName: 'Drugi dzień Bożego Narodzenia',
      name: 'Second Day of Christmas',
    },
  ];

  fallbackHolidays.forEach((holiday) => {
    holidays.value.set(holiday.date, holiday);
  });
}

// Check if a date is a holiday
function getHoliday(dateString: string): Holiday | undefined {
  return holidays.value.get(dateString);
}

// Load holidays on mount
onMounted(async () => {
  const currentYear = new Date().getFullYear();
  await fetchHolidays(currentYear);
  await fetchHolidays(currentYear + 1); // Also fetch next year's holidays
});

const calendarCurrentWeek = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const result = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
  return result;
});

const allCalendarWeeks = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const numWeeks = Math.ceil(calendarViewDays.value / 7);
  const result = Array.from({ length: numWeeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) =>
      format(addDays(weekStart, weekIndex * 7 + dayIndex), 'yyyy-MM-dd'),
    ),
  );
  return result;
});

const nextSixMonths = computed(() => {
  const currentDate = new Date();
  const months = [];

  for (let i = 1; i <= 6; i++) {
    const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    months.push({
      label: futureDate.toLocaleDateString('en-US', { month: 'short' }),
      value: format(futureDate, 'yyyy-MM-dd'),
    });
  }

  return months;
});

function previousCalendarWeeks() {
  calendarBaseDate.value = addDays(calendarBaseDate.value, -calendarViewDays.value);
  displayManager.reset();
}

function nextCalendarWeeks() {
  calendarBaseDate.value = addDays(calendarBaseDate.value, calendarViewDays.value);
  displayManager.reset();
}

function setEventDateToToday() {
  const today = new Date();
  calendarBaseDate.value = new Date();
  const formatted = format(today, 'yyyy-MM-dd');
  emit('update:selectedDate', formatted);
}

function jumpToMonth(dateString: string) {
  const targetDate = new Date(dateString);
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();
  calendarBaseDate.value = new Date(targetYear, targetMonth, 1);
  displayManager.reset();
}

function handleDateSelect(dateString: string) {
  emit('update:selectedDate', dateString);
}

// Helper functions
function getWeekLabel(dayDate: string) {
  const date = new Date(dayDate);
  const todayDate = new Date();

  const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayNormalized = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate(),
  );

  const daysDiff = Math.floor(
    (dateNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysDiff > 0) {
    if (daysDiff === 365) {
      return `+${daysDiff}d`;
    }
    if (daysDiff % 30 === 0 && daysDiff <= 360) {
      return `+${daysDiff}d`;
    }
    if (daysDiff % 7 === 0) {
      const weeksDiff = daysDiff / 7;
      return `+${weeksDiff}w`;
    }
  }

  return null;
}

function shouldWeekHaveMargin(week: string[], weekIndex: number, allWeeks: string[][]) {
  if (weekIndex === 0) return false;
  const firstDayOfWeek = new Date(week[0]!);
  const prevWeek = allWeeks[weekIndex - 1]!;
  const lastDayOfPrevWeek = new Date(prevWeek[prevWeek.length - 1]!);
  return firstDayOfWeek.getMonth() !== lastDayOfPrevWeek.getMonth();
}

function isNewMonthStart(day: string, week: string[], weekIndex: number, allWeeks: string[][]) {
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
  const previousWeek = allWeeks[weekIndex - 1]!;
  if (!previousWeek) return false;

  const currentMonth = dayDate.getMonth();
  const hasPreviousMonth = previousWeek.some((d) => new Date(d).getMonth() !== currentMonth);

  return hasPreviousMonth;
}

function shouldShowMonth(day: string, index: number, week: string[], isFirstWeek: boolean) {
  return displayManager.shouldShowMonth(day, index, week, isFirstWeek);
}

function shouldShowYear(day: string, index: number, week: string[], isFirstWeek: boolean) {
  return displayManager.shouldShowYear(day, index, week, isFirstWeek);
}

function getMonthAbbr(day: string, index: number, week: string[]) {
  const monthName = format(new Date(day), 'MMMM');

  // Add "..." prefix if this is not the first day of the month and it's the first occurrence
  const dayOfMonth = new Date(day).getDate();

  // Check if this is the first day shown in the calendar (index 0 of first week)
  const isFirstDayInCalendar = index === 0;

  // Add "..." if it's the first day in calendar but not the 1st of the month
  if (isFirstDayInCalendar && dayOfMonth !== 1) {
    return `...${monthName}`;
  }

  // Add "..." if month changed from previous day but we're not on the 1st of the month
  if (index > 0) {
    const previousDay = week[index - 1];
    if (previousDay) {
      const currentMonth = new Date(day).getMonth();
      const previousMonth = new Date(previousDay).getMonth();
      if (currentMonth !== previousMonth && dayOfMonth !== 1) {
        return `...${monthName}`;
      }
    }
  }

  return monthName;
}

function isFirstDayOfMonth(day: string) {
  return new Date(day).getDate() === 1;
}

function isAfterFirstInRow(day: string, week: string[]) {
  const date = new Date(day);
  const index = week.indexOf(day);
  if (index === 0) return false;
  const prevDay = new Date(week[index - 1]!);
  return date.getMonth() !== prevDay.getMonth();
}

function isWeekend(day: string) {
  const date = new Date(day);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday (0) or Saturday (6)
}

// Determine whether a given task occurs on the provided day string (yyyy-MM-dd).
// Use shared occursOnDay helper from utils

function getEventsForDay(day: string) {
  if (!props.tasks || !props.tasks.length) return [];
  // Return a shallow copy of matching tasks and attach the occurrence `date` so
  // callers (preview/edit) receive the specific instance date for cyclic events.
  return props.tasks
    .filter((t: any) => {
      if (t.type_id === 'Replenish' || t.type_id === 'Todo') return false;
      return occursOnDay(t, day);
    })
    .map((t: any) => ({ ...t, date: day }));
}
</script>

<style scoped>
.calendar-table {
  width: 100%;
  border-collapse: collapse;
}

.calendar-table th {
  padding: 8px 4px;
  text-align: center;
  border-left: 1px dashed #bbb;
  border-right: 1px dashed #bbb;
}

.calendar-table th:first-child,
.calendar-table td:first-child {
  border-left: none !important;
}

.calendar-table th:last-child,
.calendar-table td:last-child {
  border-right: none !important;
}

.calendar-cell {
  padding: 4px;
  text-align: center;
  vertical-align: top;
  border-top: none;
  border-bottom: none;
  border-left: 1px dashed #ddd;
  border-right: 1px dashed #ddd;
}

.calendar-day-btn {
  white-space: normal !important;
  width: calc(100% - 8px);
  margin: 0 auto;
  min-height: 60px;
  background-color: white !important;
  color: black !important;
  border: 2px solid #eee;
  position: relative;
}

.calendar-day-btn.calendar-selected {
  background-color: #1976d2 !important;
  color: white !important;
}

.calendar-day-btn.calendar-selected .calendar-day-number {
  color: white !important;
}

.calendar-day-btn.calendar-today {
  border: 4px solid #1976d2 !important;
  font-weight: bold;
}

.calendar-day-btn.calendar-weekend::before,
.calendar-day-btn.calendar-holiday::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image:
    repeating-linear-gradient(45deg, transparent, transparent 8px, #ddd 8px, #ddd 9px),
    repeating-linear-gradient(-45deg, transparent, transparent 8px, #ddd 8px, #ddd 9px);
  pointer-events: none;
  z-index: 0;
}

.calendar-day-btn.calendar-selected.calendar-weekend::before,
.calendar-day-btn.calendar-selected.calendar-holiday::before {
  background-image:
    repeating-linear-gradient(45deg, transparent, transparent 8px, #0d47a1 8px, #0d47a1 9px),
    repeating-linear-gradient(-45deg, transparent, transparent 8px, #0d47a1 8px, #0d47a1 9px);
}

.calendar-day-btn .calendar-day-content {
  position: relative;
  z-index: 1;
}

.calendar-day-content {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  height: 100%;
}

.calendar-top {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.calendar-day-number {
  font-size: 1.6em;
  font-weight: 500;
  color: black;
}

.calendar-today-label {
  font-size: 0.9em;
  color: black;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.calendar-today-label.calendar-green-label {
  color: white !important;
}

.calendar-week-label {
  font-size: 0.9em;
  color: black;
  font-weight: normal;
  letter-spacing: 0.5px;
  text-transform: none !important;
}

.calendar-green-label {
  /* Make the calendar button a column flex container so events can be auto-pushed */
  .calendar-day-btn {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 86px; /* give some vertical space so events can sit at bottom */
  }
  color: white !important;
  background-color: #1976d2 !important;
  padding: 2px 6px;
  border-radius: 4px;
}

.calendar-gray-label {
  color: black !important;
  background-color: #e0e0e0;
  padding: 2px 6px;
  border-radius: 4px;
}

.calendar-holiday-label {
  font-size: 0.75em;
  color: white !important;
  background-color: #d32f2f;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  letter-spacing: 0.3px;
  text-align: center;
  max-width: 90px;
  overflow: hidden;
  word-wrap: break-word;
  white-space: normal;
  line-height: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  /* prefer system fonts with full Latin glyph coverage for diacritics */
  font-family: Arial, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, sans-serif;
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
  color: #1976d2;
}

.new-month-week {
  border-top: 3px solid #1976d2;
}

.new-month-start {
  padding-top: 48px;
}

.calendar-day-btn.first-day-of-month {
  border-left: 5px solid #1976d2 !important;
  border-top: 5px solid #1976d2 !important;
}

.calendar-cell:has(.first-day-of-month) {
  border-top: none !important;
}

.calendar-day-btn.after-first-in-row {
  border-top: 5px solid #1976d2 !important;
}

.calendar-events {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Ensure day content stacks labels above events and pushes events to the bottom */
.calendar-day-content {
  display: flex;
  flex-direction: column;
}
.calendar-event-pill {
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
  /* allow wrapping inside the pill so titles can span up to two lines */
  white-space: normal;
  font-family: Arial, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, sans-serif;
}
.today-jump-btn {
  margin-right: 18px;
}
.first-month-btn {
  background-color: #66bb6a !important; /* warm green */
  color: #fff !important;
}
.calendar-event-pill .event-time {
  font-weight: 600;
  opacity: 0.95;
}
.calendar-event-pill .event-title {
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
  line-height: 1;
  text-transform: none !important;
}
</style>
