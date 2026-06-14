<template>
  <div
    class="calendar-root"
    :class="{ 'calendar-root--colorize': calendarTheme.colorize }"
    :style="calendarThemeVars"
  >
  <div>
    <!-- Quick Date Buttons and Next button (moved to top) -->
    <div class="top-row row items-center" :style="calendarChromeRowStyle">
      <div class="col">
        <div class="calendar-month-btns">
          <q-btn
            unelevated
            size="md"
            :color="calendarTheme.colorize ? undefined : 'blue'"
            :text-color="calendarTheme.colorize ? undefined : 'white'"
            :style="calendarControlBtnStyle"
            @click="setEventDateToToday"
            class="text-weight-bold today-jump-btn"
          >
            {{ $text("ui.today") }}
          </q-btn>
          <q-btn
            v-for="(month, index) in nextSixMonths"
            :key="month.value"
            unelevated
            size="md"
            @click="jumpToMonth(month.value)"
            class="text-weight-bold"
            :style="{
              fontSize: '16px',
              backgroundColor: buttonColors[index],
              color: buttonTextColors[index],
            }"
          >
            {{ formatMonthButtonLabel(month.value, { includeYear: index === 0 }) }}
          </q-btn>
        </div>
      </div>
    </div>
  </div>
  <div class="row items-center">
    <div class="col calendar-grid-col">
      <div class="calendar-grid-shell">
        <q-btn
          unelevated
          round
          :color="calendarTheme.colorize ? undefined : 'primary'"
          :text-color="calendarTheme.colorize ? undefined : 'white'"
          :style="calendarControlBtnStyle"
          :aria-label="`${$text('ui.prev')}: ${calendarNavPrevRange.from}, ${calendarNavPrevRange.to}`"
          :title="`${$text('ui.prev')}: ${calendarNavPrevRange.from} — ${calendarNavPrevRange.to}`"
          class="calendar-float-nav calendar-float-nav--prev"
          @click="previousCalendarWeeks"
        >
          <q-icon name="chevron_left" class="calendar-float-nav-icon" />
        </q-btn>
        <q-btn
          unelevated
          round
          :color="calendarTheme.colorize ? undefined : 'primary'"
          :text-color="calendarTheme.colorize ? undefined : 'white'"
          :style="calendarControlBtnStyle"
          :aria-label="`${$text('ui.next')}: ${calendarNavNextRange.from}, ${calendarNavNextRange.to}`"
          :title="`${$text('ui.next')}: ${calendarNavNextRange.from} — ${calendarNavNextRange.to}`"
          class="calendar-float-nav calendar-float-nav--next"
          @click="nextCalendarWeeks"
        >
          <q-icon name="chevron_right" class="calendar-float-nav-icon" />
        </q-btn>
        <div ref="scrollFlipEl" class="calendar-scroll-flip">
        <div ref="tableWrapper" class="calendar-table-wrapper">
          <table class="calendar-table">
            <thead>
              <tr>
                <th
                  v-for="(day, dayHeaderIndex) in calendarCurrentWeek"
                  :key="'header-' + day"
                  class="text-center text-weight-bold text-caption calendar-weekday-th"
                  :class="{
                    'calendar-weekday-th--alt': dayHeaderIndex % 2 === 1,
                    'calendar-weekend-th': isWeekend(day),
                  }"
                  scope="col"
                >
                  {{ ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][parseDay(day).getDay()] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(week, weekIndex) in allCalendarWeeks"
                :key="'week-' + weekIndex"
              >
                <td
                  v-for="(day, index) in week"
                  :key="day"
                  :class="[
                    'calendar-cell',
                    { 'calendar-today-column': index === todayColumnIndex },
                  ]"
                  :data-day="day"
                  :data-month="String(parseDay(day).getMonth() + 1).padStart(2, '0')"
                >
                  <div
                    :class="{
                      'new-month-start': isNewMonthStart(
                        day,
                        week,
                        weekIndex,
                        allCalendarWeeks
                      ),
                      'month-start': true,
                    }"
                  >
                    <Watermark
                      v-if="
                        shouldShowMonth(day, index, week, weekIndex === 0) ||
                        shouldShowYear(day, index, week, weekIndex === 0)
                      "
                      :label="
                        getMonthAbbr(day, index, week) +
                        (shouldShowYear(day, index, week, weekIndex === 0) ||
                        new Date(day).getFullYear() !== new Date().getFullYear()
                          ? ' ' + new Date(day).getFullYear()
                          : '')
                      "
                      :background="`blur(60px) ${overlayColorForMonth(day)[0]}`"
                      :color="overlayColorForMonth(day)[1]"
                      text-blend-mode="normal"
                      justifyContent="flex-start"
                      class="calendar-month-label-above"
                      size="small"
                    />
                    <div v-else class="calendar-month-label-above"></div>
                  </div>
                  <div
                    class="calendar-day-slot"
                    :class="[
                      { 'calendar-weekend': isWeekend(day) },
                      { 'calendar-holiday': !!getHoliday(day) },
                      { 'calendar-selected': day === selectedDate },
                      {
                        'calendar-past':
                          day <= format(addDays(new Date(), -1), 'yyyy-MM-dd'),
                      },
                    ]"
                  >
                  <div
                    v-if="isDayHasEvents(day)"
                    class="calendar-day-badge"
                    aria-hidden="true"
                  >
                    <span class="calendar-day-badge__arc" />
                    <span class="calendar-day-badge__num">{{ parseDay(day).getDate() }}</span>
                  </div>
                  <q-btn
                    size="sm"
                    @pointerdown="onDayPointerDown($event, day)"
                    @pointerup="onDayPointerUp($event)"
                    @pointercancel="cancelLongPressDay"
                    @pointerleave="cancelLongPressDay"
                    @click="onDayClick($event, day)"
                    @contextmenu="handleDateSelect($event, day, true)"
                    :title="formatAppWeekday(parseDay(day), 'long')"
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
                      {
                        'calendar-past':
                          day <= format(addDays(new Date(), -1), 'yyyy-MM-dd'),
                      },
                      { 'calendar-day-date-only': isDayDateOnly(day) },
                      { 'calendar-day-has-events': isDayHasEvents(day) },
                    ]"
                  >
                    <div class="calendar-day-content">
                      <div class="calendar-top">
                        <div class="calendar-day-row">
                          <div v-if="!isDayHasEvents(day)" class="calendar-day-number">
                            {{ parseDay(day).getDate() }}
                          </div>
                          <div v-if="getWeekLabel(day)" class="calendar-week-inline">
                            {{ getWeekLabel(day) }}
                          </div>
                        </div>

                        <div
                          v-if="day === format(new Date(), 'yyyy-MM-dd')"
                          class="calendar-today-label calendar-green-label"
                        >
                          {{ $text("ui.today") }}
                        </div>
                        <div
                          v-else-if="
                            day === format(addDays(new Date(), -1), 'yyyy-MM-dd')
                          "
                          class="calendar-today-label"
                        >
                          {{ $text("ui.yesterday") }}
                        </div>
                        <div
                          v-else-if="day === format(addDays(new Date(), 1), 'yyyy-MM-dd')"
                          class="calendar-today-label calendar-gray-label"
                        >
                          {{ $text("ui.tomorrow") }}
                        </div>
                        <div v-else-if="getHoliday(day)" class="calendar-holiday-label">
                          {{
                            holidayDisplayLang && holidayDisplayLang.startsWith("en")
                              ? getHoliday(day)?.name
                              : getHoliday(day)?.localName
                          }}
                        </div>
                      </div>
                      <!-- Render events for this day (including cyclic repeats) -->
                      <div class="calendar-events">
                        <template v-if="props.tasks && props.tasks.length">
                          <div
                            v-for="ev in getEventsForDay(day)"
                            :key="ev.id + '-' + (ev.eventTime || '')"
                            :class="ev.timeMode === 'holiday' ? 'calendar-holiday-pill q-pa-xs' : 'calendar-event-pill q-pa-xs'"
                            :title="ev.name + (ev.eventTime ? ' • ' + ev.eventTime : '')"
                            :style="ev.timeMode === 'holiday' ? {} : {
                              backgroundColor: themePriorityColors[ev.priority] || '#888',
                              color: themePriorityTextColor
                                ? themePriorityTextColor(ev.priority)
                                : '#fff',
                            }"
                          >
                            <span
                              class="event-time"
                              v-if="ev.eventTime && ev.timeMode !== 'holiday'"
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
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Visible days per page -->
  <div class="bottom-row row q-mb-md items-center" :style="calendarChromeRowStyle">
    <div class="col pagination-range-options">
      <div class="visible-days-control" :style="calendarPaginationStyle">
        <span class="visible-days-label text-subtitle2">{{
          $text("ui.visible_days")
        }}</span>
        <q-option-group
          v-model="calendarViewDays"
          type="radio"
          :options="[
            { label: $text('ui.visible_days_14'), value: 14 },
            { label: $text('ui.visible_days_42'), value: 42 },
            { label: $text('ui.visible_days_3months'), value: 84 },
          ]"
          color="white"
          inline
          dense
          size="sm"
        />
      </div>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onUpdated,
  onBeforeUnmount,
  onMounted,
} from "vue";
import { format, addDays, startOfWeek, differenceInCalendarDays } from "date-fns";
import logger from "src/utils/logger";
import {
  $text,
  getLanguage,
  getCountryCode,
  getLocale,
} from "src/modules/lang";
import {
  type Holiday,
  refreshHolidayData,
  resolveHolidayLocale,
} from "src/modules/time/holidaySyncService";
import {
  HOLIDAY_SYNC_CHANGED_EVENT,
  loadHolidaySyncEnabled,
} from "src/modules/time/holidaySyncSettings";
import {
  formatAppMonthLong,
  formatAppMonthShort,
  formatAppWeekday,
} from "src/modules/lang/dateFormat";
import { useLongPress } from "src/composables/useLongPress";
import CC from "src/CCAccess";
import {
  occursOnDay,
  parseYmdLocal,
  formatMonthButtonLabel,
} from "src/modules/task/utils/occursOnDay";
import { isExcludedFromCalendarTask } from "src/modules/task/utils/calendarTaskTypes";
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  getOverlayColorForMonth,
  getCalendarChromeBarStyle,
  getCalendarControlColors,
  getCalendarCssVariables,
  resolveCalendarTheme,
} from "../theme";
import Watermark from "src/components/ui/Watermark.vue";

const props = defineProps<{
  selectedDate?: string;
  // Optional list of tasks so the calendar can render events
  tasks?: Array<any>;
}>();

// Parse a YYYY-MM-DD day string into a local Date (avoid UTC parsing pitfalls)
function parseDay(s: string) {
  return parseYmdLocal(s) || new Date(s);
}

const emit = defineEmits<{
  (e: "update:selectedDate", value: string): void;
  (e: "preview-task", payload: any): void;
  (e: "edit-task", id: string | null): void;
  (e: "day-click", payload: { date: string; rect: DOMRect | null }): void;
}>();

// Long-press composable for event pills
const {
  startLongPress,
  cancelLongPress,
  setLongPressHandler,
  longPressTriggered,
} = useLongPress();

// Long-press composable for calendar DAY buttons (separate instance)
const {
  startLongPress: startLongPressDay,
  cancelLongPress: cancelLongPressDay,
  setLongPressHandler: setLongPressHandlerDay,
  longPressTriggered: longPressTriggeredDay,
} = useLongPress();

const dayLongPressedRecently = ref(false);

// Long-press should open edit mode for events; short press shows preview.
setLongPressHandler((task: any) => {
  // Wrap async work in an IIFE and intentionally do not return the Promise
  void (async () => {
    try {
      try {
        // Prefer to handle edit internally via API so parent doesn't need to wire handlers
        // Set active task and switch to edit mode
        // Using static `CC` import at top
        if (
          CC &&
          CC.task &&
          CC.task.active &&
          typeof CC.task.active.setMode === "function"
        ) {
          if (CC.task && CC.task.active && CC.task.active.setTask)
            CC.task.active.setTask(task ?? null);
          CC.task.active.setMode("edit");
        }
      } catch (e) {
        // ignore internal handling failures
      }
      emit("edit-task", task?.id ?? null);
    } catch (e) {
      // ignore
    }
  })();
});

// For day buttons, long-press should trigger the same behaviour as right-click
setLongPressHandlerDay((payload: any) => {
  try {
    // payload may be either a date string (yyyy-MM-dd) or an object
    // { date: string, rect: DOMRect | null } supplied from pointerdown
    let date = "";
    let rect: DOMRect | null = null;
    if (payload && typeof payload === "object" && "date" in payload) {
      // payload is an object with `date` and optional `rect`
      // direct property access is fine here (payload is `any`-like)
      date = String(payload.date);
      rect = payload.rect ?? null;
    } else {
      date = typeof payload === "string" ? payload : String(payload);
    }
    dayLongPressedRecently.value = true;
    // Emit day-click with rect so parent can position the add form like a right-click
    emit("day-click", { date, rect });
    // Also update selectedDate/time via api like right-click handler does
    try {
      if (CC.task && CC.task.time && typeof CC.task.time.setCurrentDate === "function") {
        CC.task.time.setCurrentDate(date);
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
});

// Using static `api` import at top (no dynamic loader needed)

async function onEventPointerUp(task: any) {
  try {
    // If long-press wasn't triggered, treat as a short click -> preview
    if (!longPressTriggered.value) {
      try {
        if (CC.task && CC.task.active && typeof CC.task.active.setMode === "function") {
          if (CC.task && CC.task.active && CC.task.active.setTask)
            CC.task.active.setTask(task ?? null);
          CC.task.active.setMode("preview");
        }
      } catch (e) {
        // ignore internal handling failures
      }
      // Emit the full task/event object (includes `date` when coming from getEventsForDay)
      emit("preview-task", task ?? null);
    }
  } catch (e) {
    // ignore
  } finally {
    cancelLongPress();
  }
}

// Note: day pointerup is intentionally ignored — long-press handler fires on timeout

function onDayPointerDown(ev: PointerEvent, day: string) {
  try {
    // start the long-press for this day; `startLongPressDay` expects (payload, ev?)
    try {
      (ev.currentTarget as Element | null)?.setPointerCapture?.(ev.pointerId);
    } catch (e) {
      void e;
    }
    // Capture bounding rect of the target so long-press can act like a contextmenu
    let rect: DOMRect | null = null;
    try {
      const el = (ev.currentTarget ?? ev.target) as Element | null;
      if (el instanceof Element) rect = el.getBoundingClientRect();
    } catch (e) {
      void e;
    }
    startLongPressDay({ date: day, rect }, ev);
  } catch (e) {
    // ignore
  }
}

function onDayPointerUp(ev: PointerEvent) {
  try {
    try {
      (ev.currentTarget as Element | null)?.releasePointerCapture?.(ev.pointerId);
    } catch (e) {
      void e;
    }
    // If long-press already triggered, prevent the following click by
    // stopping propagation and marking suppression flag (handled by onDayClick)
    if (longPressTriggeredDay.value) {
      try {
        ev.preventDefault?.();
        ev.stopPropagation?.();
      } catch (e) {
        void e;
      }
    }
  } finally {
    cancelLongPressDay();
  }
}

function onDayClick(ev: Event, day: string) {
  // Ignore clicks that immediately follow a long-press
  if (dayLongPressedRecently.value || longPressTriggeredDay.value) {
    dayLongPressedRecently.value = false;
    try {
      ev.stopPropagation?.();
      ev.preventDefault?.();
    } catch (e) {
      void e;
    }
    return;
  }
  handleDateSelect(ev, day, false);
}

const calendarBaseDate = ref(new Date());
const calendarViewDays = ref(42);

// Minimal month edges collector: stores [firstCell, lastCell] for each month
const tableWrapper = ref<HTMLElement | null>(null);
const scrollFlipEl = ref<HTMLElement | null>(null);

// Scroll so the target day is in view with the previous calendar day visible
// to the left when possible (avoids pinning today flush to the viewport edge).
// Runs once on mount only.
function scrollToDay(dateStr: string) {
  try {
    const container = scrollFlipEl.value;
    const wrapper = tableWrapper.value;
    if (!container || !wrapper) return;
    const cell = wrapper.querySelector<HTMLElement>(`td[data-day="${dateStr}"]`);
    if (!cell) return;
    let scrollTarget = cell.offsetLeft;
    const base = parseYmdLocal(dateStr);
    if (base) {
      const prevStr = format(addDays(base, -1), "yyyy-MM-dd");
      const prevCell = wrapper.querySelector<HTMLElement>(`td[data-day="${prevStr}"]`);
      if (prevCell) scrollTarget = prevCell.offsetLeft;
      else scrollTarget = Math.max(0, cell.offsetLeft - cell.offsetWidth);
    }
    // offsetLeft is relative to the wrapper; container scrolls the wrapper
    container.scrollLeft = scrollTarget;
  } catch (e) {
    // ignore — non-critical
  }
}
const activeGroupRecord = computed((): Record<string, unknown> | null => {
  try {
    const gid = CC.group.active.activeGroup.value?.value ?? null;
    if (!gid) return null;
    const list = CC.group.list.all.value ?? [];
    const g = list.find((x: any) => String(x?.id) === String(gid));
    return g && typeof g === "object" ? (g as unknown as Record<string, unknown>) : null;
  } catch {
    return null;
  }
});

const calendarTheme = computed(() => resolveCalendarTheme(activeGroupRecord.value));

const calendarThemeVars = computed(() => getCalendarCssVariables(calendarTheme.value));

/** Inline chrome strip behind month buttons + pagination (scoped SCSS vars were not applying). */
const calendarChromeRowStyle = computed(() =>
  getCalendarChromeBarStyle(calendarTheme.value),
);

const calendarControlBtnStyle = computed(() => {
  if (!calendarTheme.value.colorize) return {};
  const { backgroundColor, color } = getCalendarControlColors(calendarTheme.value);
  return { backgroundColor, color };
});

const calendarPaginationStyle = computed(() => {
  if (!calendarTheme.value.colorize) return {};
  const { backgroundColor, color } = getCalendarControlColors(calendarTheme.value);
  return {
    backgroundColor,
    color,
  };
});

function overlayColorForMonth(monthLike: string | number | Date): [string, string] {
  return getOverlayColorForMonth(monthLike, calendarTheme.value);
}

const monthEdges = ref<Array<[HTMLElement, HTMLElement]>>([]);

function collectMonthEdges() {
  // collectMonthEdges start
  monthEdges.value = [];
  const rootNode: ParentNode = tableWrapper.value ?? document;
  const nodeList = rootNode.querySelectorAll<HTMLTableCellElement>("td.calendar-cell");
  const cells = Array.from(nodeList);
  if (!cells.length) return;

  const map = new Map<string, HTMLTableCellElement[]>();
  for (const cell of cells) {
    const dayAttr = cell.getAttribute?.("data-day") || cell.textContent || "";
    const month = (
      cell.getAttribute?.("data-month") || String(new Date(dayAttr).getMonth() + 1)
    ).padStart(2, "0");
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(cell);
  }

  for (const [, arr] of map.entries()) {
    if (arr.length) monthEdges.value.push([arr[0]!, arr[arr.length - 1]!]);
  }
  // collectMonthEdges result available in monthEdges.value
}

onMounted(() => {
  nextTick().then(() => {
    collectMonthEdges();
    createOverlaysFromEdges();
    // Initial scroll: show today with previous day visible when in range
    scrollToDay(format(new Date(), "yyyy-MM-dd"));
  });
});

onUpdated(() => {
  nextTick().then(collectMonthEdges);
});

// --- DOM overlays (appends absolute divs under the calendar table) ---
function removeExistingOverlays() {
  try {
    document
      .querySelectorAll(".co21-month-overlay, .co21-month-separator")
      .forEach((n) => n.remove());
  } catch (e) {
    // ignore
  }
}

function createOverlaysFromEdges() {
  removeExistingOverlays();
  const wrapper =
    tableWrapper.value ?? document.querySelector<HTMLElement>(".calendar-table-wrapper");
  if (!wrapper) return;
  const tableRect = wrapper.getBoundingClientRect();
  const z = window.getComputedStyle(wrapper).zIndex || "1";

  // group cells by row to create a single overlay segment per contiguous run
  const rows = Array.from(
    wrapper.querySelectorAll<HTMLTableRowElement>("table.calendar-table tbody tr")
  );

  if (getComputedStyle(wrapper).position === "static")
    wrapper.style.position = "relative";

  // Build map of months -> array of segment descriptors (grouped per row)
  // we include optional row/column metadata for separator calculations
  const monthSegments = new Map<
    string,
    Array<{
      top: number;
      left: number;
      width: number;
      height: number;
      row?: number;
      startCol?: number;
      endCol?: number;
    }>
  >();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const cells = Array.from(
      row.querySelectorAll<HTMLTableCellElement>("td.calendar-cell")
    );
    const rowRect = row.getBoundingClientRect();
    const rowTop = rowRect.top - tableRect.top;
    const rowHeight = Math.max(0, rowRect.height) + 1; // +1 creates border overlap - with blend effect.
    for (let i = 0; i < cells.length; ) {
      const cell = cells[i]!;
      const month = (cell.dataset?.month ?? "01").toString().padStart(2, "0");
      // start run
      let j = i + 1;
      while (
        j < cells.length &&
        (cells[j]!.dataset?.month ?? "") === (cell.dataset?.month ?? "")
      )
        j++;
      // cells from i .. j-1 are contiguous for this month on this row
      const firstRect = cell.getBoundingClientRect();
      const lastRect = cells[j - 1]!.getBoundingClientRect();
      const left = Math.round(firstRect.left - tableRect.left);
      const top = rowTop;
      const width = Math.max(0, Math.round(lastRect.right - firstRect.left));
      const height = rowHeight;

      if (!monthSegments.has(month)) monthSegments.set(month, []);
      monthSegments.get(month)!.push({
        top,
        left,
        width,
        height,
        row: rowIndex,
        startCol: i,
        endCol: j - 1,
      });

      i = j;
    }
  }

  // Create one overlay per month segment (few per month).
  // Overlay color comes from `getOverlayColorForMonth` (no per-month JPG background).

  for (const [month, segments] of monthSegments.entries()) {
    for (const seg of segments) {
      const div = document.createElement("div");
      div.className = "co21-month-overlay";
      div.setAttribute("data-month", month);
      div.dataset.left = String(seg.left);
      div.dataset.top = String(seg.top);
      if ((seg as any).row !== undefined) div.dataset.row = String((seg as any).row);
      if ((seg as any).startCol !== undefined)
        div.dataset.startCol = String((seg as any).startCol);
      if ((seg as any).endCol !== undefined)
        div.dataset.endCol = String((seg as any).endCol);
      const [overlayColor] = overlayColorForMonth(month);
      Object.assign(div.style, {
        position: "absolute",
        top: `${seg.top}px`,
        left: `${seg.left}px`,
        width: `${seg.width}px`,
        height: `${seg.height}px`,
        backgroundColor: overlayColor,
        pointerEvents: "none",
        opacity: "0.8",
        mixBlendMode: "normal",
        zIndex: String(Math.max(0, Number(z) + 1)),
      } as any);
      wrapper.prepend(div);
    }

    const overlays = Array.from(
      wrapper.querySelectorAll<HTMLDivElement>(
        `.co21-month-overlay[data-month="${month}"]`
      )
    );
    for (const o of overlays) {
      const segTop = Number(o.dataset.top || "0");
      const segHeight = Math.max(0, Math.round(o.getBoundingClientRect().height));
      const segRow = Number(o.dataset.row ?? -1);
      const segStart = Number(o.dataset.startCol ?? -1);
      const segEnd = Number(o.dataset.endCol ?? -1);

      try {
        const sepThickness = 4;

        const createHSep = (
          leftPx: number,
          topPx: number,
          widthPx: number,
          monthKey: string,
        ) => {
          const s = document.createElement("div");
          s.className = "co21-month-separator";
          Object.assign(s.style, {
            position: "absolute",
            left: `${Math.max(0, Math.round(leftPx))}px`,
            top: `${Math.max(0, Math.round(topPx))}px`,
            width: `${Math.max(0, Math.round(widthPx))}px`,
            height: `${sepThickness}px`,
            backgroundColor: overlayColorForMonth(monthKey)[0],
            pointerEvents: "none",
            zIndex: "0",
            boxShadow: "0 0 6px rgba(0,0,0,0.12)",
          } as any);
          wrapper.appendChild(s);
        };

        if (segRow > 0) {
          const aboveRow = rows[segRow - 1]!;
          const aboveCells = Array.from(
            aboveRow.querySelectorAll<HTMLTableCellElement>("td.calendar-cell")
          );
          let runStart = -1;
          for (let c = segStart; c <= segEnd; c++) {
            const aboveMonth = aboveCells[c]
              ? aboveCells[c]!.dataset.month ?? ""
              : "";
            const differs = aboveMonth !== month;
            if (differs && runStart === -1) runStart = c;
            if (!differs && runStart !== -1) {
              const leftRect = aboveCells[runStart]!.getBoundingClientRect();
              const rightRect = aboveCells[c - 1]!.getBoundingClientRect();
              const leftPx = Math.round(leftRect.left - tableRect.left);
              const widthPx = Math.round(rightRect.right - leftRect.left);
              const prevMonth = aboveCells[runStart]?.dataset.month ?? month;
              createHSep(leftPx, segTop, widthPx, prevMonth);
              runStart = -1;
            }
          }
          if (runStart !== -1) {
            const leftRect = aboveCells[runStart]!.getBoundingClientRect();
            const rightRect = aboveCells[segEnd]!.getBoundingClientRect();
            const leftPx = Math.round(leftRect.left - tableRect.left);
            const widthPx = Math.round(rightRect.right - leftRect.left);
            const prevMonth = aboveCells[runStart]?.dataset.month ?? month;
            createHSep(leftPx, segTop, widthPx, prevMonth);
          }
        }

        if (segRow >= 0 && segRow < rows.length - 1) {
          const belowRow = rows[segRow + 1]!;
          const belowCells = Array.from(
            belowRow.querySelectorAll<HTMLTableCellElement>("td.calendar-cell")
          );
          let runStart = -1;
          for (let c = segStart; c <= segEnd; c++) {
            const belowMonth = belowCells[c]
              ? belowCells[c]!.dataset.month ?? ""
              : "";
            const differs = belowMonth !== month;
            if (differs && runStart === -1) runStart = c;
            if (!differs && runStart !== -1) {
              const leftRect = belowCells[runStart]!.getBoundingClientRect();
              const rightRect = belowCells[c - 1]!.getBoundingClientRect();
              const leftPx = Math.round(leftRect.left - tableRect.left);
              const widthPx = Math.round(rightRect.right - leftRect.left);
              createHSep(leftPx, segTop + segHeight - sepThickness, widthPx, month);
              runStart = -1;
            }
          }
          if (runStart !== -1) {
            const leftRect = belowCells[runStart]!.getBoundingClientRect();
            const rightRect = belowCells[segEnd]!.getBoundingClientRect();
            const leftPx = Math.round(leftRect.left - tableRect.left);
            const widthPx = Math.round(rightRect.right - leftRect.left);
            createHSep(leftPx, segTop + segHeight - sepThickness, widthPx, month);
          }
        }
      } catch (e) {
        // ignore per-segment separator creation
      }
    }
  }

  // Draw segmented vertical separators per-row at boundaries where the
  // month changes between adjacent cells. This ensures separators appear
  // exactly at the visual junctions when rows mix months.
  try {
    const rowsForSep = Array.from(
      wrapper.querySelectorAll<HTMLTableRowElement>("table.calendar-table tbody tr")
    );
    for (const row of rowsForSep) {
      const cells = Array.from(
        row.querySelectorAll<HTMLTableCellElement>("td.calendar-cell")
      );
      if (!cells.length) continue;
      const rowRect = row.getBoundingClientRect();
      const top = Math.round(rowRect.top - tableRect.top);
      const height = Math.max(0, Math.round(rowRect.height));

      for (let i = 0; i < cells.length - 1; i++) {
        const mA = cells[i]!.dataset.month;
        const mB = cells[i + 1]!.dataset.month;
        if (mA && mB && mA !== mB) {
          const rectA = cells[i]!.getBoundingClientRect();
          const boundaryX = Math.round(rectA.right - tableRect.left);
          const sep = document.createElement("div");
          sep.className = "co21-month-separator";
          Object.assign(sep.style, {
            position: "absolute",
            top: `${Math.max(0, top)}px`,
            left: `${Math.max(0, Math.round(boundaryX - 4))}px`,
            width: `8px`,
            height: `${height}px`,
            backgroundColor: overlayColorForMonth(mA)[0],
            opacity: `1`,
            pointerEvents: "none",
            zIndex: "0",
            boxShadow: "0 0 6px rgba(0,0,0,0.12)",
          } as any);
          wrapper.appendChild(sep);
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

// Refresh overlays after edges collected
onUpdated(() => {
  nextTick().then(() => {
    collectMonthEdges();
    createOverlaysFromEdges();
  });
});

onMounted(() => {
  window.addEventListener("resize", () => {
    collectMonthEdges();
    createOverlaysFromEdges();
  });
});

onBeforeUnmount(() => {
  removeExistingOverlays();
  try {
    window.removeEventListener("resize", () => {
      collectMonthEdges();
      createOverlaysFromEdges();
    });
  } catch (e) {
    // ignore
  }
});

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
    const date = parseDay(day);
    const monthYear = format(date, "yyyy-MM");

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
    const previousMonth = parseDay(previousDay).getMonth();
    const previousYear = parseDay(previousDay).getFullYear();

    if (currentMonth !== previousMonth || currentYear !== previousYear) {
      this.shownMonths.add(monthYear);
      return true;
    }

    return false;
  }

  shouldShowYear(day: string, index: number, week: string[], isFirstWeek: boolean) {
    const date = parseDay(day);
    const year = format(date, "yyyy");
    const todayYear = format(new Date(), "yyyy");

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

const holidays = ref<Map<string, Holiday>>(new Map());
const holidaySyncEnabled = ref(true);
const holidayCountryCode = ref<string>("PL");
const holidayDisplayLang = ref<string>("en");

async function reloadHolidays(): Promise<void> {
  holidays.value = new Map();
  if (!holidaySyncEnabled.value) return;
  await refreshHolidayData(
    holidays.value,
    holidayCountryCode.value,
    holidayDisplayLang.value,
  );
}

function hasHolidayTask(dateString: string): boolean {
  if (!props.tasks?.length) return false;
  return props.tasks.some(
    (t: any) => t.timeMode === 'holiday' && (t.date === dateString || t.eventDate === dateString),
  );
}

function getHoliday(dateString: string): Holiday | undefined {
  if (!holidaySyncEnabled.value || hasHolidayTask(dateString)) return undefined;
  return holidays.value.get(dateString);
}

onMounted(async () => {
  const locale = await resolveHolidayLocale();
  holidayCountryCode.value = locale.country;
  holidayDisplayLang.value = locale.lang;
  holidaySyncEnabled.value = await loadHolidaySyncEnabled();
  await reloadHolidays();

  const onLocaleChanged = (ev: Event) => {
    try {
      const ce = ev as CustomEvent;
      const info = ce?.detail || {};
      const newCountry = info.country || getCountryCode();
      const newLang = info.lang || getLanguage();
      if (
        newCountry === holidayCountryCode.value &&
        newLang === holidayDisplayLang.value
      ) {
        return;
      }
      holidayCountryCode.value = newCountry;
      holidayDisplayLang.value = newLang;
      void reloadHolidays();
    } catch {
      // ignore
    }
  };

  const onHolidaySyncChanged = (ev: Event) => {
    const ce = ev as CustomEvent<{ enabled?: boolean }>;
    holidaySyncEnabled.value = !!ce.detail?.enabled;
    void reloadHolidays();
  };

  window.addEventListener("app:locale-changed", onLocaleChanged as EventListener);
  window.addEventListener(HOLIDAY_SYNC_CHANGED_EVENT, onHolidaySyncChanged as EventListener);

  onBeforeUnmount(() => {
    window.removeEventListener("app:locale-changed", onLocaleChanged as EventListener);
    window.removeEventListener(HOLIDAY_SYNC_CHANGED_EVENT, onHolidaySyncChanged as EventListener);
  });
});

const calendarCurrentWeek = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const result = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), "yyyy-MM-dd")
  );
  return result;
});

const allCalendarWeeks = computed(() => {
  const weekStart = startOfWeek(calendarBaseDate.value, { weekStartsOn: 1 });
  const numWeeks = Math.ceil(calendarViewDays.value / 7);
  const result = Array.from({ length: numWeeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) =>
      format(addDays(weekStart, weekIndex * 7 + dayIndex), "yyyy-MM-dd")
    )
  );
  return result;
});

/** One endpoint like `18.Maj` using app month short names (locale-aware). */
function formatNavRangeDay(d: Date): string {
  const raw = formatAppMonthShort(d);
  const month =
    raw.length > 0 ? raw.charAt(0).toLocaleUpperCase(getLocale()) + raw.slice(1) : raw;
  return `${d.getDate()}.${month}`;
}

function navRangeLineLabels(shiftCalendarBaseByDays: number): { from: string; to: string } {
  const span = calendarViewDays.value;
  const shifted = addDays(calendarBaseDate.value, shiftCalendarBaseByDays);
  const rangeStart = startOfWeek(shifted, { weekStartsOn: 1 });
  const rangeEnd = addDays(rangeStart, span - 1);
  return { from: formatNavRangeDay(rangeStart), to: formatNavRangeDay(rangeEnd) };
}

/** Start / end dates for the window after tapping Prev (two display lines). */
const calendarNavPrevRange = computed(() => navRangeLineLabels(-calendarViewDays.value));

/** Start / end dates for the window after tapping Next. */
const calendarNavNextRange = computed(() => navRangeLineLabels(calendarViewDays.value));

// Column index (0=Mon … 6=Sun) that contains today — used to tint the whole column
const todayColumnIndex = computed(() => (new Date().getDay() + 6) % 7);

const nextSixMonths = computed(() => {
  const currentDate = new Date();
  const months = [];

  for (let i = 1; i <= 6; i++) {
    const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    months.push({
      value: format(futureDate, "yyyy-MM-dd"),
    });
  }

  return months;
});

watch(
  () =>
    [
      calendarTheme.value.colorize,
      calendarTheme.value.groupColor,
      calendarTheme.value.groupTextColor,
      calendarTheme.value.colorizeTones,
    ] as const,
  () => {
    nextTick().then(() => {
      collectMonthEdges();
      createOverlaysFromEdges();
    });
  },
);

// Button colors derived from getOverlayColorForMonth so they match calendar overlays
const buttonColors = computed(() =>
  nextSixMonths.value.map((m) => overlayColorForMonth(m.value)[0]),
);
const buttonTextColors = computed(() =>
  nextSixMonths.value.map((m) => overlayColorForMonth(m.value)[1]),
);

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
  const formatted = format(today, "yyyy-MM-dd");
  emit("update:selectedDate", formatted);
}

function jumpToMonth(dateString: string) {
  const targetDate = new Date(dateString);
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();
  calendarBaseDate.value = new Date(targetYear, targetMonth, 1);
  displayManager.reset();
}

function handleDateSelect(e: Event | string, dateString?: string, isContext = false) {
  // Support both call signatures: (ev, date, isContext) and (date)
  let ev: Event | undefined;
  let date = "";
  if (typeof e === "string") {
    date = e;
  } else {
    ev = e;
    date = dateString || "";
  }
  try {
    // If this was a contextmenu (right-click), prevent the native menu and
    // compute the bounding rect so parent can position the add form.
    let rect: DOMRect | null = null;
    if (isContext && ev) {
      try {
        ev.preventDefault?.();
        ev.stopPropagation?.();
      } catch (err) {
        void err;
      }
      try {
        const el = ev.currentTarget ?? ev.target;
        if (el instanceof Element) rect = el.getBoundingClientRect();
      } catch (err) {
        void err;
      }
    }

    try {
      if (
        CC &&
        CC.task &&
        CC.task.time &&
        typeof CC.task.time.setCurrentDate === "function"
      ) {
        CC.task.time.setCurrentDate(date);
      }
    } catch (e) {
      // ignore
    }
    // Always update the selected date on left or right click
    emit("update:selectedDate", date);
    // Only emit `day-click` (for positioning add form) on right-click/contextmenu
    if (isContext) emit("day-click", { date, rect });
  } catch (e) {
    // ignore
    emit("update:selectedDate", date);
    if (isContext) emit("day-click", { date, rect: null });
  }
}

// Helper functions
function getWeekLabel(dayDate: string) {
  const date = new Date(dayDate);
  const today = new Date();

  // Use calendar-day difference to avoid timezone/DST off-by-one issues
  const daysDiff = differenceInCalendarDays(date, today);
  if (daysDiff <= 0) return null;

  // Exact year marker
  if (daysDiff === 365) return `+${daysDiff}d`;

  // Exact 30-day multiples (check explicit targets to avoid modulo pitfalls)
  for (let n = 30; n <= 360; n += 30) {
    const target = format(addDays(today, n), "yyyy-MM-dd");
    if (target === dayDate) return `+${n}d`;
  }

  // Week-based markers: check exact whole-week offsets
  for (let w = 1; w <= 52; w++) {
    const target = format(addDays(today, w * 7), "yyyy-MM-dd");
    if (target === dayDate) return `+${w}w`;
  }

  return null;
}

function isNewMonthStart(
  day: string,
  week: string[],
  weekIndex: number,
  allWeeks: string[][]
) {
  try {
    const cur = parseDay(day);
    // If it's the first day of a month, flag it
    if (cur.getDate() === 1) return true;

    const idx = week.indexOf(day);
    if (idx > 0) {
      const prev = parseDay(week[idx - 1]!);
      return prev.getMonth() !== cur.getMonth();
    }

    if (weekIndex > 0) {
      const prevWeek = allWeeks[weekIndex - 1] || [];
      const prev = parseDay(prevWeek[prevWeek.length - 1]!);
      return prev.getMonth() !== cur.getMonth();
    }
  } catch (e) {
    // conservative fallback
    return false;
  }
  return false;
}

function shouldShowMonth(
  day: string,
  index: number,
  week: string[],
  isFirstWeek: boolean
) {
  return displayManager.shouldShowMonth(day, index, week, isFirstWeek);
}

function shouldShowYear(
  day: string,
  index: number,
  week: string[],
  isFirstWeek: boolean
) {
  return displayManager.shouldShowYear(day, index, week, isFirstWeek);
}

function getMonthAbbr(day: string, index: number, week: string[]) {
  const monthName = formatAppMonthLong(parseDay(day));

  // !!! Removed prefix in comment - it's visually clearer with watermark component, but i can change my mind later if needed
  // Add "..." prefix if this is not the first day of the month and it's the first occurrence
  // const dayOfMonth = new Date(day).getDate();

  // // Check if this is the first day shown in the calendar (index 0 of first week)
  // const isFirstDayInCalendar = index === 0;

  // Add "..." if it's the first day in calendar but not the 1st of the month
  // if (isFirstDayInCalendar && dayOfMonth !== 1) {
  //   return `${monthName}`;
  // }

  // // Add "..." if month changed from previous day but we're not on the 1st of the month
  // if (index > 0) {
  //   const previousDay = week[index - 1];
  //   if (previousDay) {
  //     const currentMonth = new Date(day).getMonth();
  //     const previousMonth = new Date(previousDay).getMonth();
  //     if (currentMonth !== previousMonth && dayOfMonth !== 1) {
  //       return `...${monthName}`;
  //     }
  //   }
  // }

  return monthName;
}

function weekHasMonthStart(week: string[]) {
  return week.some((d) => parseDay(d).getDate() === 1);
}

function getWeekWatermarkLabel(week: string[]) {
  const first = week.find((d) => parseDay(d).getDate() === 1);
  if (!first) return "";
  return formatAppMonthLong(parseDay(first));
}

function isFirstDayOfMonth(day: string) {
  return parseDay(day).getDate() === 1;
}

function isAfterFirstInRow(day: string, week: string[]) {
  const date = parseDay(day);
  const index = week.indexOf(day);
  if (index === 0) return false;
  const prevDay = parseDay(week[index - 1]!);
  return date.getMonth() !== prevDay.getMonth();
}

function isWeekend(day: string) {
  const date = parseDay(day);
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
      if (isExcludedFromCalendarTask(t)) return false;
      return occursOnDay(t, day);
    })
    .map((t: any) => ({ ...t, date: day }));
}

function isDayDateOnly(day: string): boolean {
  if (getEventsForDay(day).length > 0) return false;
  if (getWeekLabel(day)) return false;
  if (getHoliday(day)) return false;
  const today = format(new Date(), 'yyyy-MM-dd');
  if (day === today) return false;
  if (day === format(addDays(new Date(), -1), 'yyyy-MM-dd')) return false;
  if (day === format(addDays(new Date(), 1), 'yyyy-MM-dd')) return false;
  return true;
}

function isDayHasEvents(day: string): boolean {
  return getEventsForDay(day).length > 0;
}

</script>

<style scoped>
.calendar-day-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.calendar-week-inline {
  display: inline-flex;
  align-items: center;
  font-size: 0.82em;
  color: var(--cal-day-muted-fg, rgba(236, 239, 241, 0.55));
  background: transparent;
  padding: 2px 6px;
  border-radius: 6px;
  margin-left: 6px;
}
</style>

<style scoped src="../../css/calendar-view.scss"></style>

<style lang="scss">
/* Chrome + controls: unscoped; vars from getCalendarCssVariables on .calendar-root */
.calendar-root.calendar-root--colorize {
  .top-row,
  .bottom-row {
    background-color: var(--cal-chrome-bg) !important;
  }

  .calendar-nav-arrow.q-btn,
  .calendar-float-nav.q-btn,
  .today-jump-btn.q-btn {
    background-color: var(--cal-nav-btn-bg) !important;
    color: var(--cal-nav-btn-fg) !important;
  }

  .visible-days-control {
    background-color: var(--cal-pagination-bg) !important;
    color: var(--cal-pagination-fg) !important;
  }

  .calendar-table th.calendar-weekday-th:not(.calendar-weekend-th) {
    background: var(--cal-weekday-bg) !important;
  }

  .calendar-table th.calendar-weekday-th--alt:not(.calendar-weekend-th) {
    background: var(--cal-weekday-alt-bg) !important;
  }

  td.calendar-today-column {
    background-color: var(--cal-today-column-bg) !important;
  }

  .calendar-day-btn.calendar-weekend::before,
  .calendar-day-btn.calendar-holiday::before {
    background-color: var(--cal-weekend-highlight) !important;
  }

  .calendar-day-btn.calendar-selected {
    background-color: var(--cal-selected-bg) !important;
    color: var(--cal-selected-fg) !important;

    .calendar-day-number {
      color: var(--cal-selected-day-fg) !important;
    }
  }
}
</style>
