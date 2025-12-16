<template>
  <q-card class="q-mb-md bg-grey-1">
    <q-card-section>
      <div class="row items-center justify-between q-mb-sm">
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
          <q-separator vertical inset />
          <q-btn flat color="primary" size="sm" @click="setEventDateToToday">
            Today
          </q-btn>
          <q-btn
            v-for="month in nextSixMonths"
            :key="month.value"
            flat
            color="primary"
            size="sm"
            @click="jumpToMonth(month.value)"
          >
            {{ month.label }}
          </q-btn>
        </div>
      </div>
      <div class="row items-center">
        <q-btn
          unelevated
          icon="chevron_left"
          label="Prev"
          color="primary"
          text-color="white"
          @click="previousCalendarWeeks"
          size="sm"
          class="q-mr-xs"
        />
        <div class="col">
          <table class="calendar-table">
            <thead>
              <tr>
                <th
                  v-for="day in calendarCurrentWeek"
                  :key="'header-' + day"
                  class="text-center text-weight-bold text-caption text-grey-7"
                >
                  {{ ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][new Date(day).getDay()] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(week, weekIndex) in allCalendarWeeks"
                :key="'week-' + weekIndex"
                :class="{
                  'new-month-week': shouldWeekHaveMargin(
                    week,
                    weekIndex,
                    allCalendarWeeks
                  ),
                }"
              >
                <td v-for="(day, index) in week" :key="day" class="calendar-cell">
                  <div
                    :class="{
                      'new-month-start': isNewMonthStart(
                        day,
                        week,
                        weekIndex,
                        allCalendarWeeks
                      ),
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
                    ]"
                  >
                    <div class="calendar-day-content">
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
                  </q-btn>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <q-btn
          unelevated
          icon-right="chevron_right"
          label="Next"
          color="primary"
          text-color="white"
          @click="nextCalendarWeeks"
          size="sm"
          class="q-ml-xs"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { format, addDays, startOfWeek } from "date-fns";

const props = defineProps<{
  selectedDate?: string;
}>();

const emit = defineEmits<{
  (e: "update:selectedDate", value: string): void;
}>();

const calendarBaseDate = ref(new Date());
const calendarViewDays = ref(42);
const shownMonths = ref(new Set<string>());
const shownYears = ref(new Set<string>());

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

// Load holidays from localStorage
function loadHolidaysFromCache(year: number): boolean {
  try {
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
  } catch (error) {
    console.error("Failed to load holidays from cache:", error);
    return false;
  }
}

// Save holidays to localStorage
function saveHolidaysToCache(year: number, holidayList: Holiday[]) {
  try {
    const cacheKey = `holidays_PL_${year}`;
    const cache: HolidayCache = {
      year,
      holidays: holidayList,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) {
    console.error("Failed to save holidays to cache:", error);
  }
}

// Fetch holidays for Poland from API
async function fetchHolidays(year: number) {
  // Try to load from cache first
  if (loadHolidaysFromCache(year)) {
    console.log(`Loaded holidays for ${year} from cache`);
    return;
  }

  // Fetch from API if not in cache
  try {
    console.log(`Fetching holidays for ${year} from API...`);

    // Use XMLHttpRequest instead of fetch to avoid QUIC protocol issues in Electron
    const data: Holiday[] = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 5000;
      xhr.open("GET", `https://date.nager.at/api/v3/PublicHolidays/${year}/PL`);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error("Failed to parse JSON"));
          }
        } else {
          reject(new Error(`HTTP error! status: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.ontimeout = () => reject(new Error("Request timeout"));
      xhr.send();
    });

    // Store holidays in Map for quick lookup
    data.forEach((holiday) => {
      holidays.value.set(holiday.date, holiday);
    });

    // Save to cache
    saveHolidaysToCache(year, data);
    console.log(`Cached ${data.length} holidays for ${year}`);
  } catch (error) {
    console.warn(`Failed to fetch holidays for ${year}, using fallback:`, error);
    // Load fallback holidays
    loadFallbackHolidays(year);
  }
}

// Fallback Polish holidays (major ones that don't change)
function loadFallbackHolidays(year: number) {
  const fallbackHolidays: Holiday[] = [
    { date: `${year}-01-01`, localName: "Nowy Rok", name: "New Year's Day" },
    { date: `${year}-01-06`, localName: "Trzech Króli", name: "Epiphany" },
    { date: `${year}-05-01`, localName: "Święto Pracy", name: "Labour Day" },
    {
      date: `${year}-05-03`,
      localName: "Święto Konstytucji 3 Maja",
      name: "Constitution Day",
    },
    {
      date: `${year}-08-15`,
      localName: "Wniebowzięcie Najświętszej Maryi Panny",
      name: "Assumption of Mary",
    },
    { date: `${year}-11-01`, localName: "Wszystkich Świętych", name: "All Saints' Day" },
    {
      date: `${year}-11-11`,
      localName: "Narodowe Święto Niepodległości",
      name: "Independence Day",
    },
    { date: `${year}-12-25`, localName: "Boże Narodzenie", name: "Christmas Day" },
    {
      date: `${year}-12-26`,
      localName: "Drugi dzień Bożego Narodzenia",
      name: "Second Day of Christmas",
    },
  ];

  fallbackHolidays.forEach((holiday) => {
    holidays.value.set(holiday.date, holiday);
  });

  console.log(`Loaded ${fallbackHolidays.length} fallback holidays for ${year}`);
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
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));
});

const allCalendarWeeks = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const numWeeks = Math.ceil(calendarViewDays.value / 7);
  return Array.from({ length: numWeeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) =>
      format(addDays(weekStart, weekIndex * 7 + dayIndex), "yyyy-MM-dd")
    )
  );
});

const nextSixMonths = computed(() => {
  const currentDate = new Date();
  const months = [];

  for (let i = 1; i <= 6; i++) {
    const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    months.push({
      label: futureDate.toLocaleDateString("en-US", { month: "short" }),
      value: format(futureDate, "yyyy-MM-dd"),
    });
  }

  return months;
});

function previousCalendarWeeks() {
  calendarBaseDate.value = addDays(calendarBaseDate.value, -calendarViewDays.value);
  shownMonths.value = new Set();
  shownYears.value = new Set();
}

function nextCalendarWeeks() {
  calendarBaseDate.value = addDays(calendarBaseDate.value, calendarViewDays.value);
  shownMonths.value = new Set();
  shownYears.value = new Set();
}

function setEventDateToToday() {
  const today = new Date();
  calendarBaseDate.value = new Date();
  emit("update:selectedDate", format(today, "yyyy-MM-dd"));
}

function jumpToMonth(dateString: string) {
  const targetDate = new Date(dateString);
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();
  calendarBaseDate.value = new Date(targetYear, targetMonth, 1);
  shownMonths.value = new Set();
  shownYears.value = new Set();
}

function handleDateSelect(dateString: string) {
  emit("update:selectedDate", dateString);
}

// Helper functions
function getWeekLabel(dayDate: string) {
  const date = new Date(dayDate);
  const todayDate = new Date();

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

function isNewMonthStart(
  day: string,
  week: string[],
  weekIndex: number,
  allWeeks: string[][]
) {
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
  const previousWeek = allWeeks[weekIndex - 1]!;
  if (!previousWeek) return false;

  const currentMonth = dayDate.getMonth();
  const hasPreviousMonth = previousWeek.some(
    (d) => new Date(d).getMonth() !== currentMonth
  );

  return hasPreviousMonth;
}

function shouldShowMonth(
  day: string,
  index: number,
  week: string[],
  isFirstWeek: boolean
) {
  const date = new Date(day);
  const monthYear = format(date, "yyyy-MM");

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
  const previousDay = week[index - 1];
  if (!previousDay) return false;

  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();
  const previousMonth = new Date(previousDay).getMonth();
  const previousYear = new Date(previousDay).getFullYear();

  // Show if month or year changed
  if (currentMonth !== previousMonth || currentYear !== previousYear) {
    shownMonths.value.add(monthYear);
    return true;
  }

  return false;
}

function shouldShowYear(
  day: string,
  index: number,
  week: string[],
  isFirstWeek: boolean
) {
  const date = new Date(day);
  const year = format(date, "yyyy");
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
  const previousDay = week[index - 1];
  if (!previousDay) return false;

  const currentYear = date.getFullYear();
  const previousYear = new Date(previousDay).getFullYear();

  if (currentYear !== previousYear) {
    shownYears.value.add(year);
    return true;
  }

  return false;
}

function getMonthAbbr(day: string, index: number, week: string[]) {
  const monthName = format(new Date(day), "MMMM");

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
  border-top: none;
  border-bottom: none;
  border-left: 1px dashed #ddd;
  border-right: 1px dashed #ddd;
}

.calendar-day-btn {
  white-space: normal !important;
  width: 100%;
  min-height: 60px;
  background-color: white !important;
  color: black !important;
  border: 2px solid #eee;
}

.calendar-day-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
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
  font-weight: bold;
  letter-spacing: 0.3px;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
