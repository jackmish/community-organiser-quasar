<template>
  <div>
    <!-- Quick Date Buttons and Next button (moved to top) -->
    <div class="top-row row items-center">
      <div class="col">
        <div class="calendar-month-btns">
          <q-btn
            unelevated
            size="md"
            color="blue"
            text-color="white"
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
            :style="{ fontSize: '16px', backgroundColor: buttonColors[index], color: 'white' }"
          >
            {{ String(new Date(month.value).getMonth() + 1).padStart(2, "0") }}.{{
              month.label.toUpperCase()
            }}{{ index === 0 ? " " + month.value.slice(0, 4) : "" }}
          </q-btn>
        </div>
      </div>
    </div>
  </div>
  <div class="row items-center">
    <div class="col">
      <div ref="scrollFlipEl" class="calendar-scroll-flip">
        <div ref="tableWrapper" class="calendar-table-wrapper">
        <table class="calendar-table">
          <thead>
            <tr>
              <th
                v-for="day in calendarCurrentWeek"
                :key="'header-' + day"
                class="text-center text-weight-bold text-caption"
              >
                {{ ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][parseDay(day).getDay()] }}
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
              <td
                v-for="(day, index) in week"
                :key="day"
                :class="['calendar-cell', { 'calendar-today-column': index === todayColumnIndex }]"
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
                    :background="`blur(60px) ${getOverlayColorForMonth(day)}`"
                    color="#00000085"
                    justifyContent="flex-start"
                    class="calendar-month-label-above"
                    size="small"
                  />
                  <div v-else class="calendar-month-label-above"></div>
                </div>
                <q-btn
                  size="sm"
                  @pointerdown="onDayPointerDown($event, day)"
                  @pointerup="onDayPointerUp($event)"
                  @pointercancel="cancelLongPressDay"
                  @pointerleave="cancelLongPressDay"
                  @click="onDayClick($event, day)"
                  @contextmenu="handleDateSelect($event, day, true)"
                  :title="
                    parseDay(day).toLocaleDateString('en-US', {
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
                    {
                      'calendar-past':
                        day <= format(addDays(new Date(), -1), 'yyyy-MM-dd'),
                    },
                  ]"
                >
                  <div class="calendar-day-content">
                    <div class="calendar-top">
                      <div class="calendar-day-row">
                        <div class="calendar-day-number">
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
                        v-else-if="day === format(addDays(new Date(), -1), 'yyyy-MM-dd')"
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
    </div>
  </div>
  <!-- Prev button and visible days per page option (moved to bottom) -->
  <div class="bottom-row row q-mb-md items-center">
    <div class="col pagination-range-options">
      <div class="visible-days-control">
        <span class="visible-days-label text-subtitle2">{{ $text("ui.visible_days") }}</span>
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
    <div class="col text-right">
      <q-btn
        unelevated
        icon="chevron_left"
        :label="$text('ui.prev')"
        color="primary"
        text-color="white"
        @click="previousCalendarWeeks"
        size="md"
        class="calendar-nav-btn"
        style="margin-right: 8px"
      />
      <q-btn
        unelevated
        icon-right="chevron_right"
        :label="$text('ui.next')"
        color="primary"
        text-color="white"
        @click="nextCalendarWeeks"
        size="md"
        class="calendar-nav-btn"
      />
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
  detectAndSetLocale,
  getLanguage,
  getCountryCode,
  loadSavedLocale,
} from "src/modules/lang";
import { useLongPress } from "src/composables/useLongPress";
import CC from "src/CCAccess";
import { occursOnDay, parseYmdLocal } from "src/modules/task/utils/occursOnDay";
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  getOverlayColorForMonth,
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

const dayLongPressedRecently = ref(false);

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

// Scroll the calendar so today (or the initial selectedDate) is at the left
// edge of the viewport. Runs once on mount only.
function scrollToDay(dateStr: string) {
  try {
    const container = scrollFlipEl.value;
    const wrapper = tableWrapper.value;
    if (!container || !wrapper) return;
    const cell = wrapper.querySelector<HTMLElement>(`td[data-day="${dateStr}"]`);
    if (!cell) return;
    // offsetLeft is relative to the wrapper; container scrolls the wrapper
    container.scrollLeft = cell.offsetLeft;
  } catch (e) {
    // ignore — non-critical
  }
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
    // Scroll calendar so today is at the left edge on initial load
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
  const tableWidth = Math.max(0, Math.round(wrapper.clientWidth || tableRect.width));
  const tableHeight = Math.max(0, Math.round(wrapper.clientHeight || tableRect.height));

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
      const top = Math.round(firstRect.top - tableRect.top);
      const width = Math.max(0, Math.round(lastRect.right - firstRect.left));
      const height = Math.max(0, Math.round(firstRect.height));

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

  // Create one overlay per month segment (few per month)
  const todayMonth = new Date().getMonth() + 1; // 1-12
  // overlay color selection is provided by `getOverlayColorForMonth` in theme

  for (const [month, segments] of monthSegments.entries()) {
    const url = `/images/months/bg_${month}.jpg`;
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
      // compute overlay color using shared helper
      const overlayColor = getOverlayColorForMonth(month);
      Object.assign(div.style, {
        position: "absolute",
        top: `${seg.top}px`,
        left: `${seg.left}px`,
        width: `${seg.width}px`,
        height: `${seg.height}px`,
        // backgroundImage: `url(${url})`,
        backgroundColor: overlayColor,
        //Note: "#1976d2", looks very good as bg
        // initial: center the image in each overlay (first-solution behavior)
        backgroundSize: `cover`,
        backgroundPosition: `center center`,
        backgroundRepeat: "no-repeat",
        opacity: "1",
        pointerEvents: "none",
        mixBlendMode: "multiply",
        zIndex: String(Math.max(0, Number(z) + 1)),
      } as any);
      wrapper.prepend(div);
    }
    // preload and compute cover-scale so all segments align like `background-size: cover`
    const img = new Image();
    img.onload = () => {
      try {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) return;

        // scale image to behave like `background-size: cover` for the whole table
        const scale = Math.max(tableWidth / iw, tableHeight / ih);
        const scaledW = Math.round(iw * scale);
        const scaledH = Math.round(ih * scale);

        // when an image is cover-scaled and centered, its top-left is offset by
        // half of the extra dimension. Compute those offsets so each segment can
        // position the scaled image consistently.
        const offsetX = Math.round((scaledW - tableWidth) / 2);
        const offsetY = Math.round((scaledH - tableHeight) / 2);

        const overlays = Array.from(
          wrapper.querySelectorAll<HTMLDivElement>(
            `.co21-month-overlay[data-month="${month}"]`
          )
        );
        for (const o of overlays) {
          const segLeft = Number(o.dataset.left || "0");
          const segTop = Number(o.dataset.top || "0");
          const segHeight = Math.max(0, Math.round(o.getBoundingClientRect().height));
          const segRow = Number(o.dataset.row ?? -1);
          const segStart = Number(o.dataset.startCol ?? -1);
          const segEnd = Number(o.dataset.endCol ?? -1);

          // position the scaled image so segments line up as if the whole table
          // were painted with a single cover-centered background image
          const posX = -offsetX - segLeft;
          const posY = -offsetY - segTop;

          o.style.backgroundSize = `${scaledW}px ${scaledH}px`;
          o.style.backgroundPosition = `${posX}px ${posY}px`;

          // Horizontal separators: create per-column fragment separators
          // where the row above or below has different month values. This
          // avoids splitting days inside the same month.
          try {
            const sepThickness = 4;

            // helper to create a separator fragment
            const createHSep = (leftPx: number, topPx: number, widthPx: number) => {
              const s = document.createElement("div");
              s.className = "co21-month-separator";
              Object.assign(s.style, {
                position: "absolute",
                left: `${Math.max(0, Math.round(leftPx))}px`,
                top: `${Math.max(0, Math.round(topPx))}px`,
                width: `${Math.max(0, Math.round(widthPx))}px`,
                height: `${sepThickness}px`,
                backgroundColor: "#1976d2",
                pointerEvents: "none",
                zIndex: "9999",
                boxShadow: "0 0 6px rgba(0,0,0,0.12)",
              } as any);
              wrapper.appendChild(s);
            };

            // check above row for differences and draw top separators only
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
                  createHSep(leftPx, segTop, widthPx);
                  runStart = -1;
                }
              }
              if (runStart !== -1) {
                const leftRect = aboveCells[runStart]!.getBoundingClientRect();
                const rightRect = aboveCells[segEnd]!.getBoundingClientRect();
                const leftPx = Math.round(leftRect.left - tableRect.left);
                const widthPx = Math.round(rightRect.right - leftRect.left);
                createHSep(leftPx, segTop, widthPx);
              }
            }

            // check below row for differences and draw bottom separators
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
                  createHSep(leftPx, segTop + segHeight - sepThickness, widthPx);
                  runStart = -1;
                }
              }
              if (runStart !== -1) {
                const leftRect = belowCells[runStart]!.getBoundingClientRect();
                const rightRect = belowCells[segEnd]!.getBoundingClientRect();
                const leftPx = Math.round(leftRect.left - tableRect.left);
                const widthPx = Math.round(rightRect.right - leftRect.left);
                createHSep(leftPx, segTop + segHeight - sepThickness, widthPx);
              }
            }
          } catch (e) {
            // ignore per-segment separator creation
          }
        }
      } catch (e) {
        // ignore
      }
    };
    img.onerror = () => {
      console.warn(`month image not found: ${url}`);
    };
    img.src = url;
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
            backgroundColor: `#1976d2`,
            opacity: `1`,
            pointerEvents: "none",
            zIndex: "9999",
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

// Detected holiday country code and display language
const holidayCountryCode = ref<string>("PL");
const holidayDisplayLang = ref<string>("en");

// Locale detection moved to `src/modules/lang` (detectAndSetLocale)

// Get holidays file path
async function getHolidaysFilePath(year: number): Promise<string | null> {
  if (!isElectron) return null;

  const appDataPath = await (window as any).electronAPI.getAppDataPath();
  return (window as any).electronAPI.joinPath(
    appDataPath,
    "holidays",
    `holidays_${holidayCountryCode.value}_${holidayDisplayLang.value}_${year}.json`
  );
}

// Load holidays from APPDATA (Electron) or localStorage (browser)
async function loadHolidaysFromCache(year: number): Promise<boolean> {
  try {
    if (isElectron) {
      // Load from APPDATA file
      // Try language-specific file first, then fall back to legacy filename
      const filePath = await getHolidaysFilePath(year);
      if (!filePath) return false;

      let exists = await (window as any).electronAPI.fileExists(filePath);
      let data: HolidayCache | null = null;

      if (exists) {
        data = await (window as any).electronAPI.readJsonFile(filePath);
      } else {
        // Legacy file name without language component
        const appDataPath = await (window as any).electronAPI.getAppDataPath();
        const legacyPath = (window as any).electronAPI.joinPath(
          appDataPath,
          "holidays",
          `holidays_${holidayCountryCode.value}_${year}.json`
        );
        const legacyExists = await (window as any).electronAPI.fileExists(legacyPath);
        if (legacyExists) {
          try {
            data = await (window as any).electronAPI.readJsonFile(legacyPath);
            // Migrate: save under the new language-specific path
            const safe = JSON.parse(JSON.stringify(data));
            await (window as any).electronAPI.ensureDir(
              (window as any).electronAPI.joinPath(appDataPath, "holidays")
            );
            await (window as any).electronAPI.writeJsonFile(filePath, safe);
            exists = true;
          } catch (e) {
            // ignore and treat as not found
          }
        }
      }

      if (!data) return false;

      // Load holidays into Map (no expiry check for APPDATA files)
      data.holidays.forEach((holiday) => {
        holidays.value.set(holiday.date, holiday);
      });

      return true;
    } else {
      // Load from localStorage. Prefer language-specific key, but fall back to
      // legacy key without language to support older installs.
      const langKey = `holidays_${holidayCountryCode.value}_${holidayDisplayLang.value}_${year}`;
      const legacyKey = `holidays_${holidayCountryCode.value}_${year}`;
      let cached = localStorage.getItem(langKey);
      let usedLegacy = false;
      if (!cached) {
        cached = localStorage.getItem(legacyKey);
        usedLegacy = !!cached;
      }

      if (!cached) return false;

      const data: HolidayCache = JSON.parse(cached);

      // Check if cache is still valid (less than 30 days old)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const isExpired = Date.now() - data.fetchedAt > thirtyDaysMs;

      if (isExpired) {
        try {
          if (usedLegacy) localStorage.removeItem(legacyKey);
          else localStorage.removeItem(langKey);
        } catch (e) {
          // ignore
        }
        return false;
      }

      // Load holidays into Map
      data.holidays.forEach((holiday) => {
        holidays.value.set(holiday.date, holiday);
      });

      // If we used legacy data (no language in key), save it under the
      // language-specific key so future loads are per-language.
      if (usedLegacy) {
        try {
          localStorage.setItem(langKey, JSON.stringify(data));
          localStorage.removeItem(legacyKey);
        } catch (e) {
          // ignore storage errors
        }
      }

      return true;
    }
  } catch (error) {
    logger.error("Failed to load holidays from cache:", error);
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
        "holidays"
      );
      await (window as any).electronAPI.ensureDir(dirPath);

      // Write file (serialize to plain JSON first to avoid structured-clone errors
      // when crossing the contextBridge boundary)
      const safe = JSON.parse(JSON.stringify(cache));
      await (window as any).electronAPI.writeJsonFile(filePath, safe);
    } else {
      // Save to localStorage
      // Save under a language-specific key so cached data is tied to
      // the display language as well as country/year.
      const cacheKey = `holidays_${holidayCountryCode.value}_${holidayDisplayLang.value}_${year}`;
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    }
  } catch (error) {
    logger.error("Failed to save holidays to cache:", error);
  }
}

// Fetch holidays for Poland from API
async function fetchHolidays(year: number) {
  // Try to load from cache first
  const loaded = await loadHolidaysFromCache(year);
  if (loaded) {
    return;
  }

  // In browser, fetch from API if not in cache
  try {
    // Use XMLHttpRequest instead of fetch to avoid QUIC protocol issues in Electron
    const data: Holiday[] = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 5000;
      xhr.open(
        "GET",
        `https://date.nager.at/api/v3/PublicHolidays/${year}/${holidayCountryCode.value}`
      );
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
    await saveHolidaysToCache(year, data);
  } catch (error) {
    logger.warn(
      `Failed to fetch holidays for ${year}. Its not important, but if you need holidays probably there is firewall or network issue:`,
      error
    );
    // Load fallback holidays
  }
}

// Check if a date is a holiday
function getHoliday(dateString: string): Holiday | undefined {
  return holidays.value.get(dateString);
}

// Load holidays on mount
onMounted(async () => {
  // detect/load user's locale via lang module so we know which country code to request
  try {
    // Prefer saved locale from app settings (appdata) so startup uses stored language
    try {
      await loadSavedLocale();
      holidayCountryCode.value = getCountryCode();
      holidayDisplayLang.value = getLanguage();
    } catch (e) {
      // Fallback: detect from navigator if no saved locale
      try {
        const info = await detectAndSetLocale();
        holidayCountryCode.value = info.country;
        holidayDisplayLang.value = info.lang;
      } catch (err) {
        // ignore - defaults already set
      }
    }
  } catch (e) {
    // ignore - defaults already set
  }
  const currentYear = new Date().getFullYear();
  await fetchHolidays(currentYear);
  await fetchHolidays(currentYear + 1); // Also fetch next year's holidays
  // Listen for locale changes at runtime and refresh holiday data
  try {
    const handler = (ev: Event) => {
      try {
        const ce = ev as CustomEvent;
        const info = ce?.detail || {};
        const newCountry = info.country || getCountryCode();
        const newLang = info.lang || getLanguage();
        // If nothing changed, ignore
        if (
          newCountry === holidayCountryCode.value &&
          newLang === holidayDisplayLang.value
        )
          return;
        holidayCountryCode.value = newCountry;
        holidayDisplayLang.value = newLang;
        // Clear existing holidays and refetch for current and next year
        holidays.value = new Map();
        void (async () => {
          const y = new Date().getFullYear();
          try {
            await fetchHolidays(y);
            await fetchHolidays(y + 1);
          } catch (e) {
            // ignore
          }
        })();
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener("app:locale-changed", handler as EventListener);
    // remove listener on unmount
    try {
      onBeforeUnmount(() => {
        try {
          window.removeEventListener("app:locale-changed", handler as EventListener);
        } catch (e) {
          // ignore
        }
      });
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
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

// Column index (0=Mon … 6=Sun) that contains today — used to tint the whole column
const todayColumnIndex = computed(() => (new Date().getDay() + 6) % 7);

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

// Button colors derived from getOverlayColorForMonth so they match calendar overlays
const buttonColors = computed(() =>
  nextSixMonths.value.map((m) => getOverlayColorForMonth(m.value))
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

function shouldWeekHaveMargin(week: string[], weekIndex: number, allWeeks: string[][]) {
  if (weekIndex === 0) return false;
  const firstDayOfWeek = parseDay(week[0]!);
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
  const monthName = format(parseDay(day), "MMMM");

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
  return format(parseDay(first), "MMMM");
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
      if (t.type_id === "Todo") return false;
      if (t.type_id === "Replenish") return false;
      return occursOnDay(t, day);
    })
    .map((t: any) => ({ ...t, date: day }));
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
  color: rgba(0, 0, 0, 0.6);
  background: transparent;
  padding: 2px 6px;
  border-radius: 6px;
  margin-left: 6px;
}
</style>

<style scoped src="../../css/calendar-view.scss"></style>
