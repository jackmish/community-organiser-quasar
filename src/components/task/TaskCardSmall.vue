<template>
  <q-item
    class="q-pa-sm task-card"
    :class="{
      'bg-grey-2': Number(item.status_id) === 0,
      'selected-task': selectedTaskId === item.id,
    }"
    :data-task-id="item.id"
    :style="itemStyle(item)"
    :active="selectedTaskId === item.id"
    clickable
    @pointerdown="() => startLongPress(item)"
    @pointerup="cancelLongPress"
    @pointercancel="cancelLongPress"
    @pointerleave="cancelLongPress"
    @click="handleTaskClick($event)"
    @contextmenu.stop.prevent="() => emit('task-context', item.value, getBoundingRect())"
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
                  'text-strike':
                    Number(item.status_id) === 0 && item.timeMode !== 'prepare',
                },
                'title-ellipsis',
              ]"
            >
              <span
                v-if="item.priority === 'high' || item.priority === 'critical'"
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
              <strong>
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
                <span v-if="countTodoSubtasks(item).total > 0">
                  ({{ countTodoSubtasks(item).done }}/{{
                    countTodoSubtasks(item).total
                  }})&nbsp;
                </span>
              </strong>
            </q-item-label>
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
            <span style="white-space: pre-line">{{ getEventHoursDisplay(item) }}</span>
          </q-item-label>
        </div>
      </div>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { ref, toRef } from "vue";
import { useLongPress } from "src/composables/useLongPress";
import CC from "src/CentralController";
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  priorityDefinitions as themePriorityDefinitions,
  typeIcons,
  highlightIcon,
} from "../theme";
import { hexToRgba, getContrastColor } from "src/utils/colorUtils";
import { countTodoSubtasks, countStarredUndone } from "src/modules/task/utils/todo";
import { formatDisplayDate, parseYmdLocal } from "src/modules/task/utils/occursOnDay";
import { $text } from "src/modules/lang";

const props = defineProps<{
  item: any;
  selectedTaskId: string | null;
  activeGroupId?: any;
}>();
const emit = defineEmits<{
  (e: "task-click", t: any, rect?: DOMRect | null): void;
  (e: "task-context", t: any, rect?: DOMRect | null): void;
}>();

const { startLongPress, cancelLongPress, longPressTriggered } = useLongPress();

// Use shared long-press handler so global edit behavior and floating preview both work

const priorityColor = (p: any) => themePriorityColors[p] || "transparent";
const priorityTextColor = (p: any) => themePriorityTextColor(p);

const typeColors: Record<string, string> = {
  TimeEvent: "#2196f3",
  Todo: "#4caf50",
  NoteLater: "#9e9e9e",
  Replenish: "#c9a676",
};

const item = toRef(props, "item") as any;

const getDisplayName = (task: any) => {
  if (!task) return "";
  const name = task.name || "";
  try {
    if (Number(task.status_id) === 0 && task.timeMode === "prepare") {
      return `${name} [prepared]`;
    }
  } catch (e) {
    void e;
  }
  return name;
};

const isTodoType = (task: any) => {
  const t = String(task?.type || task?.type_id || "").toLowerCase();
  return t.includes("todo");
};

const hasDate = (task: any) => {
  if (!task) return false;
  if (task.type === "event" || task.type_id === "TimeEvent") return true;
  if (task?.eventTime) return true;
  if (task?.date || task?.eventDate) return true;
  return false;
};

const getEventHoursDisplay = (task: any) => {
  const dateStr = task?.date || task?.eventDate || "";
  const timeStr = task?.eventTime || "";
  if (!dateStr) return "";

  const formatShortDate = (s: string) => {
    const d = parseYmdLocal(s) || new Date(s);
    if (!d || isNaN(d.getTime())) return formatDisplayDate(s);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  };

  try {
    const mode =
      task?.timeMode || (task && (task.timeOffsetDays ? "prepare" : "event")) || "event";
    if (mode === "prepare" || mode === "expiration") {
      const evD = parseYmdLocal(dateStr);
      const today = new Date();
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (evD) {
        const evMid = new Date(evD.getFullYear(), evD.getMonth(), evD.getDate());
        const diffDays = Math.round((evMid.getTime() - todayMid.getTime()) / 86400000);
        let rel = "";
        if (diffDays === 0) rel = $text("date.today");
        else if (diffDays === 1) rel = $text("date.tomorrow");
        else if (diffDays > 1)
          rel = $text("date.in_days").replace("{n}", String(diffDays));
        else rel = $text("date.days_ago").replace("{n}", String(Math.abs(diffDays)));

        const shortDate = formatShortDate(dateStr);
        if (timeStr) return `${rel}\n${shortDate} | ${timeStr}`;
        return `${rel}\n${shortDate}`;
      }
    }
  } catch (e) {
    void e;
  }

  if (timeStr) {
    try {
      const evD = parseYmdLocal(dateStr);
      if (evD) {
        const today = new Date();
        const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const evMid = new Date(evD.getFullYear(), evD.getMonth(), evD.getDate());
        const diffDays = Math.round((evMid.getTime() - todayMid.getTime()) / 86400000);
        if (diffDays === 0) return `${$text("date.today")} | ${timeStr}`;
        if (diffDays === 1) return `${$text("date.tomorrow")} | ${timeStr}`;
        if (diffDays > 1 && diffDays <= 6)
          return `${evD.toLocaleDateString(undefined, { weekday: "long" })} | ${timeStr}`;
      }
    } catch (e) {
      void e;
    }
    const shortDate = formatShortDate(dateStr);
    return `${shortDate} | ${timeStr}`;
  }

  const d = parseYmdLocal(dateStr) || new Date(dateStr);
  if (!d || isNaN(d.getTime())) return formatDisplayDate(dateStr);
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dateMid.getTime() - todayMid.getTime()) / 86400000);
  if (diffDays === 0) return $text("date.today");
  if (diffDays === 1) return $text("date.tomorrow");
  if (diffDays === -1) return $text("date.yesterday");
  return formatDisplayDate(dateStr);
};

const itemStyle = (task: any) => {
  if (!task) return {};
  if (Number(task.status_id) === 0) return {};
  const bg = priorityColor(task.priority) || "#ffffff";
  const color = priorityTextColor(task.priority) || "inherit";
  const typeColor = typeColors[task.type_id || task.type] || "transparent";

  // Prefer group color for the shadow if available, otherwise fall back to
  // the task background (priority) color, finally a default.
  // If this task belongs to the active group, use a high-contrast text
  // color instead of the group's background color.
  // Normalize incoming activeGroupId to a simple string id so callers can
  // pass either a raw id, number, or an object like `{ value, id }`.
  const normalizeActiveId = (v: any): string | null => {
    if (v == null) return null;
    try {
      if (typeof v === "object") return String(v.value ?? v.id ?? null);
      return String(v);
    } catch (e) {
      return null;
    }
  };

  const activeId = normalizeActiveId((props as any).activeGroupId);
  // If caller didn't pass an `activeGroupId` prop, fall back to the shared
  // controller's activeGroup so the component still highlights correctly.
  const fallbackActive = normalizeActiveId(CC.group.active.activeGroup?.value);
  const resolvedActiveId = activeId || fallbackActive;
  const isActiveGroup = Boolean(
    task._group && resolvedActiveId && String(task._group.id) === String(resolvedActiveId)
  );

  let baseColor = task._group?.color || bg || "#1976d2";
  if (isActiveGroup) baseColor = getContrastColor(task._group?.color || baseColor);

  // Map priority to an alpha between 1.0 (highest) and 0.2 (lowest).
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const pIdx = priorityOrder[task.priority] ?? 3;
  const alpha = Math.max(0.2, 1 - (pIdx * (1 - 0.2)) / 3);

  const shadow = hexToRgba(baseColor, alpha);

  return {
    backgroundColor: bg,
    color,
    borderLeft: `4px solid ${typeColor}`,
    boxShadow: `0 10px 30px ${shadow}`,
  } as Record<string, string>;
};

const handleTaskClick = (evt: Event) => {
  if (longPressTriggered.value) {
    longPressTriggered.value = false;
    return;
  }
  try {
    // Prefer resolving rect from the DOM using the data attribute to avoid
    // cases where evt.currentTarget isn't a DOM element (framework wrappers).
    let rect: DOMRect | null = null;
    try {
      const el =
        ((evt.currentTarget as unknown) as HTMLElement) ||
        ((evt.target as unknown) as HTMLElement);
      if (el && typeof (el as any).getBoundingClientRect === "function") {
        try {
          rect = el.getBoundingClientRect();
        } catch (e) {
          rect = null;
        }
      }
    } catch (e) {
      rect = null;
    }

    // fallback to robust selector-based lookup
    if (!rect) rect = getBoundingRect();
    emit("task-click", item.value, rect);
  } catch (e) {
    emit("task-click", item.value, null);
  }
};

const getBoundingRect = (): DOMRect | null => {
  try {
    const sel = `[data-task-id="${item.value?.id}"]`;
    const el = document.querySelector(sel);
    if (el instanceof Element) return el.getBoundingClientRect();
  } catch (e) {
    void e;
  }
  return null;
};

// exports removed - `<script setup>` must not contain ES module exports
</script>

<style scoped>
/* Moved task-card related styles here from TasksListSmall.vue */
.task-card {
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: visible;
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
  font-size: 15px;
  line-height: 1.1;
}

.type-icon {
  margin-right: 6px;
  vertical-align: middle;
  display: inline-flex;
  align-items: center;
}
.priority-inline {
  position: relative;
  top: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  /* height: 18px; */
  /* border-radius: 4px; */
  font-size: 12px;
  /* line-height: 1; */
}

.type-watermark {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -35%) rotate(-10deg);
  font-size: 120px;
  opacity: 0.18;
  pointer-events: none;
  color: currentColor;
  z-index: 0;
}

.title-row,
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

.title-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px;
  flex-direction: row !important;
  position: relative;
}
.title-row > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-right: 0;
}
.title-main {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: flex-start;
}
.title-text {
  min-width: 0;
  display: block;
}
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
  white-space: normal;
}
.title-text q-item-label strong {
  font-size: 13px;
  font-weight: 600;
}
.title-text q-item-label,
.title-text q-item-label strong {
  line-height: 1.05;
}
.title-row q-item-label {
  white-space: normal !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  display: -webkit-box !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
}
.task-desc {
  display: block;
  line-height: 1.3 !important;
  margin: 0 !important;
  padding-top: 0 !important;
  color: inherit;
}
.prepare-desc {
  font-size: 11px !important;
  line-height: 1.2 !important;
}
.expiration-desc {
  font-size: 11px !important;
  line-height: 1.2 !important;
}
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
.priority-left {
  vertical-align: middle;
}
/* task-controls-grid rules moved to TasksListMedium.vue (where markup exists) */
.edit-btn .q-icon {
  color: rgba(0, 0, 0, 0.9) !important;
}
.edit-btn {
  color: rgba(0, 0, 0, 0.9) !important;
}
.menu-btn .q-icon {
  color: rgba(0, 0, 0, 0.9) !important;
}
.menu-btn {
  color: rgba(0, 0, 0, 0.9) !important;
}
.task-card {
  font-size: 13px;
}
.task-card strong {
  font-size: 17px;
  line-height: 1;
}
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
  max-height: calc(2 * 1.25em + 4px) !important;
}
.title-text q-item-label strong {
  display: block !important;
}
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
  max-height: calc(2 * 1.25em + 4px) !important;
}
.selected-task {
  border-radius: 6px;
  box-shadow: 0 0 0 4px rgb(100, 181, 246);
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
</style>
