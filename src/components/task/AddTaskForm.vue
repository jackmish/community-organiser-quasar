<script setup lang="ts">
import { computed, ref, nextTick, watch, toRef, onMounted } from "vue";
import { $text } from "src/modules/lang";
import type { Group } from "src/modules/group/models/GroupModel";
import { useQuasar } from "quasar";
import CC from "src/CCAccess";
import logger from "src/utils/logger";
import CalendarView from "src/components/time/CalendarView.vue";
import ReplenishmentList from "./ReplenishmentList.vue";
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  replenishColorSets as themeReplenishColorSets,
  getReplenishBg as themeGetReplenishBg,
  getReplenishText as themeGetReplenishText,
  typeColors as themeTypeColors,
  typeTextColors as themeTypeTextColors,
} from "../theme";
import { useRepeatSchedule } from "src/composables/useRepeatSchedule";
import { hexToRgba } from "src/utils/colorUtils";
import { useEventDateTime } from "src/composables/useEventDateTime";
import { useReplenishDropdown } from "src/composables/useReplenishDropdown";

const props = defineProps({
  filteredParentOptions: {
    type: Array,
    default: () => [],
  },
  activeGroup: {
    type: Object as () => { label: string; value: string | null } | null,
    default: null,
  },
  replenishTasks: {
    type: Array,
    default: () => [],
  },
  showCalendar: {
    type: Boolean,
    default: true,
  },
  selectedDate: {
    type: String,
    default: "",
  },
  allTasks: {
    type: Array,
    default: () => [],
  },
  // initialTask: when provided, the form will enter edit mode and pre-fill fields
  initialTask: {
    type: Object as () => any,
    default: null,
  },
  mode: {
    type: String,
    default: "add",
  },
});
const emit = defineEmits([
  "add-task",
  "update-task",
  "cancel-edit",
  "calendar-date-select",
  "filter-parent-tasks",
  "update:mode",
  "delete-task",
  "toggle-status",
  "edit-task",
]);

// Robust active group label: supports either a plain object or a Ref-like object
const activeGroupLabel = computed(() => {
  const ag: any = (props as any).activeGroup;
  if (!ag) return null;
  return ag.label ?? (ag.value && ag.value.label) ?? null;
});
const activeGroupLabelShort = computed(() => {
  const lab = activeGroupLabel.value;
  if (!lab) return null;
  try {
    return String(lab).split(" (")[0];
  } catch (e) {
    return String(lab);
  }
});

// Group menu state for edit-mode group changing
const groupMenu = ref(false);
const groups = CC.group.list.all;

function getGroupIcon(gid: string | undefined) {
  try {
    const list: any[] = (groups && groups.value) || groups || [];
    if (!gid) return "folder";
    const found = list.find((x: any) => String(x.id) === String(gid));
    return (found && found.icon) || "folder";
  } catch (e) {
    return "folder";
  }
}

function getGroupName(gid: string | undefined) {
  try {
    const list: any[] = (groups && groups.value) || groups || [];
    if (!gid) return null;
    const found = list.find((x: any) => String(x.id) === String(gid));
    return (found && found.name) || null;
  } catch (e) {
    return null;
  }
}

function getGroupChipStyle(gid: string | undefined): Record<string, string> {
  try {
    const list: any[] = (groups && groups.value) || groups || [];
    if (!gid) return {};
    const found = list.find((x: any) => String(x.id) === String(gid));
    if (!found || !found.color) return {};
    const bg = found.color;
    const text = found.textColor || found.text_color || '#ffffff';
    return { backgroundColor: bg + ' !important', color: text + ' !important' };
  } catch (e) {
    return {};
  }
}

function getGroupTextColor(gid: string | undefined): string {
  try {
    const list: any[] = (groups && groups.value) || groups || [];
    if (!gid) return 'inherit';
    const found = list.find((x: any) => String(x.id) === String(gid));
    if (!found || !found.color) return 'inherit';
    return found.textColor || found.text_color || '#ffffff';
  } catch (e) {
    return 'inherit';
  }
}

const updateTask = (...args: any[]) => CC.task.update(...(args as [any, any, any]));

async function selectGroupForEdit(gid: string | null) {
  try {
    // Use localNewTask eventDate (fallback to selectedDate prop)
    const date = localNewTask.value.eventDate || props.selectedDate || "";
    const taskId = localNewTask.value.id;
    if (!taskId) return;
    const updates: any = { groupId: gid == null ? undefined : gid };
    await updateTask(date, taskId, updates);
    // Also reflect immediately in the form state
    localNewTask.value.groupId = gid == null ? undefined : gid;
  } catch (e) {
    logger.error("Failed to change task group (edit mode)", e);
  } finally {
    groupMenu.value = false;
  }
}

async function selectGroupForAdd(gid: string | null) {
  try {
    localNewTask.value.groupId = gid == null ? undefined : gid;
  } catch (e) {
    logger.error("Failed to change task group (add mode)", e);
  } finally {
    groupMenu.value = false;
  }
}

// Input refs
const dayInput = ref<any>(null);
const monthInput = ref<any>(null);
const yearInput = ref<any>(null);
const hourInput = ref<any>(null);
const minuteInput = ref<any>(null);
const offsetInput = ref<any>(null);

// Repeat schedule — state, payload building, and cycle-type defaults managed by composable.
const {
  repeatMode,
  repeatOptions,
  repeatCycleType,
  repeatCycleOptions,
  weekDayOptions,
  repeatDays,
  everyNDayOfMonth,
  repeatIntervalDays,
  checkAllDays,
  clearDays,
  toggleDay,
  buildRepeatPayload,
  loadFromTask: loadRepeatFromTask,
  reset: resetRepeat,
} = useRepeatSchedule({ currentEventDate: toRef(props, 'selectedDate') as any });

// Local newTask state, default to today
const today = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
type TaskType = {
  name: string;
  description: string;
  type_id: string;
  status_id: number | string;
  parent_id: string | null;
  created_by: string;
  priority: string;
  // optional replenish color set id (e.g. 'set-1')
  color_set?: string | null;
  // Optional id when editing an existing task
  id?: string;
  groupId: string | undefined;
  eventDate: string;
  eventTime: string;
  // timeMode controls how the time is interpreted in the UI
  // 'event' = normal event (default), 'prepare' = preparation time, 'expiration' = expiration time
  timeMode?: "event" | "prepare" | "expiration";
  // number of days before the event (used for prepare/expiration modes)
  timeOffsetDays?: number | null;
};

const localNewTask = ref<TaskType>({
  name: "",
  description: "",
  type_id: "TimeEvent",
  // default to '1' = just created
  // default to 1 = just created (use numeric codes, not boolean)
  status_id: 1,
  parent_id: null,
  created_by: "",
  priority: "medium",
  groupId: undefined,
  eventDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
    today.getDate()
  )}`,
  eventTime: "",
  timeMode: "event",
  timeOffsetDays: 7,
});

// Remember the last selected task type so resetting the form doesn't revert the chooser.
// Persist to localStorage so the selection survives form resets/remounts.
const STORAGE_KEY = "coq:lastTaskType";
let initialStored = "TimeEvent";
try {
  const s = localStorage.getItem(STORAGE_KEY);
  if (s) initialStored = s;
} catch (e) {
  // ignore (e.g. SSR or blocked storage)
}
const lastSelectedType = ref<string>(
  initialStored || localNewTask.value.type_id || "TimeEvent"
);
watch(
  () => localNewTask.value.type_id,
  (v) => {
    if (v) {
      lastSelectedType.value = v;
      try {
        localStorage.setItem(STORAGE_KEY, v);
      } catch (e) {
        // ignore
      }
    }
  }
);

// Mode is controlled by parent via prop `mode` and `update:mode` emit
const modeRef = toRef(props, "mode") as any;
// Friendly label for current mode (match ModeSwitcher labels)
const modeLabel = computed(() => {
  return props.mode === "add"
    ? "Add new thing"
    : props.mode === "edit"
    ? "Edit thing"
    : "Preview";
});

// Mode-based accent color (creation/edit)
const modeAccentColor = computed(() => {
  if (props.mode === "add") return "#4caf50"; // green for creation
  if (props.mode === "edit") return "#ff9800"; // orange for edit
  return "#1976d2"; // default primary
});

// Card background style depending on mode; draw an 8px solid border on all sides using mode color
const cardStyle = computed(() => {
  // If the current task type is Replenish, use a light yellow background
  if (isReplenish.value) {
    const bg = "#f5efe6"; // latte-like light beige
    const accent = "#c9a676";
    return { backgroundColor: bg, border: `8px solid ${accent}` };
  }
  const bg =
    props.mode === "add" ? "#e8f5e9" : props.mode === "edit" ? "#fff3e0" : "#ffffff";
  const accent = modeAccentColor.value || "#000000";
  return { backgroundColor: bg, border: `8px solid ${accent}` };
});

// Watermark icon depending on mode/type
const watermarkIcon = computed(() => {
  try {
    const type =
      (localNewTask as any)?.value?.type_id ?? (localNewTask as any)?.type_id ?? null;
    if (props.mode === "add") {
      switch (type) {
        case "Todo":
          return "check_box";
        case "TimeEvent":
          return "event";
        case "Replenish":
          return "autorenew";
        case "NoteLater":
          return "description";
        default:
          return "add_circle";
      }
    }
    if (props.mode === "edit") {
      switch (type) {
        case "Todo":
          return "check_box";
        case "TimeEvent":
          return "event";
        case "Replenish":
          return "autorenew";
        case "NoteLater":
          return "description";
        default:
          return "edit";
      }
    }
    if (props.mode === "preview") {
      switch (type) {
        case "Todo":
          return "check_box";
        case "TimeEvent":
          return "event";
        case "Replenish":
          return "autorenew";
        case "NoteLater":
          return "description";
        default:
          return "visibility";
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
});

// (watermark color removed — revert to default monochrome)

// Quasar screen for responsive button sizing
const $q = useQuasar();
const btnSize = computed(() => ($q.screen.gt.sm ? "md" : "sm"));
const isReplenish = computed(() => (localNewTask.value.type_id || "") === "Replenish");
const showPriorityLabel = computed(() => $q.screen.gt.sm);
const showFullTypeLabel = computed(() => $q.screen.gt.md);

// Submit button appearance based on mode
const submitColor = computed(() => {
  // When creating a Replenish item, prefer the selected replenish set
  try {
    if (props.mode === "add" && isReplenish.value) {
      const cs = (localNewTask as any).color_set;
      const bg = (themeGetReplenishBg as any)(cs);
      return bg && bg !== "transparent" ? bg : themeTypeColors.Replenish || "#f5efe6";
    }
  } catch (e) {
    // fall back
  }
  if (props.mode === "add") return "#4caf50";
  if (props.mode === "edit") return "#ff9800";
  return "primary";
});

const submitTextColor = computed(() => {
  try {
    if (props.mode === "add" && isReplenish.value) {
      const cs = (localNewTask as any).color_set;
      const txt = (themeGetReplenishText as any)(cs);
      return txt && txt !== "inherit" ? txt : themeTypeTextColors.Replenish || "#212121";
    }
  } catch (e) {
    // ignore
  }
  return "#ffffff";
});

const submitIcon = computed(() => {
  if (props.mode === "add") return "add";
  if (props.mode === "edit") return "edit";
  return "";
});

function extractGroupId(ag: any) {
  if (!ag) return undefined;
  try {
    if (Object.prototype.hasOwnProperty.call(ag, "value")) {
      const inner = ag.value;
      if (!inner) return undefined;
      if (
        typeof inner === "object" &&
        Object.prototype.hasOwnProperty.call(inner, "value")
      )
        return inner.value;
      if (typeof inner === "string" || typeof inner === "number") return inner;
      return undefined;
    }
    if (typeof ag === "object" && Object.prototype.hasOwnProperty.call(ag, "value"))
      return ag.value;
    if (typeof ag === "string" || typeof ag === "number") return ag;
  } catch (e) {
    // ignore
  }
  return undefined;
}

// Type options for task type selector (local only)
const typeOptions = [
  { label: "Time Event", shortLabel: "Time", value: "TimeEvent", icon: "event" },
  { label: "TODO", shortLabel: "Todo", value: "Todo", icon: "check_box" },
  { label: "Replenish", shortLabel: "Repl", value: "Replenish", icon: "autorenew" },
  { label: "Note", shortLabel: "Note", value: "NoteLater", icon: "description" },
];

// ── Date/time logic (extracted to composable) ─────────────────────────────────
const {
  timeType,
  timeTypeOptions,
  timeModeOptions,
  autoIncrementYear,
  eventTimeHour,
  eventTimeMinute,
  eventDateTimeHoursDiff,
  eventTimeHoursDisplay,
  getTimeDifferenceDisplay,
  cachedTime,
  eventTimeMode,
  eventTimeOffsetDays,
  setOffsetDays,
  eventDate,
  eventDateParts,
  eventDateYear,
  eventDateMonth,
  eventDateDay,
} = useEventDateTime(localNewTask);

// Use centralized replenish color sets from theme
const replenishColorSets = themeReplenishColorSets;

// Split into four rows for display and include a transparent 'x' swatch
const replenishColorRows = computed(() => {
  // include a transparent option at the start
  const transparent = { id: "transparent", bg: "transparent", text: "#000000" };
  const all = [transparent, ...replenishColorSets];
  const n = all.length;
  const per = Math.ceil(n / 4);
  return [
    all.slice(0, per),
    all.slice(per, per * 2),
    all.slice(per * 2, per * 3),
    all.slice(per * 3),
  ];
});

// When creating new tasks, keep the form open after save by default for Replenish.
// Initialize based on last selected type or current localNewTask type when in add mode.
const stayAfterSave = ref(
  (props.mode === "add" &&
    (localNewTask.value.type_id === "Replenish" ||
      lastSelectedType.value === "Replenish")) ||
    false
);

// ── Replenish dropdown (extracted to composable) ──────────────────────────────
const {
  replenishInput,
  replenishQuery,
  selectedReplenishId,
  showReplenishList,
  replenishListStyle,
  replenishMatches,
  smallReplenishTasks,
  replenishAlreadyAdded,
  selectReplenishMatch,
  handleReplItemPointer,
  createReplenishFromInput,
  onReplenishInput,
  onReplenishFocus,
} = useReplenishDropdown({
  localNewTask,
  allTasks: toRef(props, "allTasks") as any,
  replenishTasks: toRef(props, "replenishTasks") as any,
  selectedDate: toRef(props, "selectedDate") as any,
  stayAfterSave,
  emit: emit as (event: string, ...args: any[]) => void,
  updateTask,
});

// When user switches type to Replenish while in add mode, focus the search input
watch(
  () => localNewTask.value.type_id,
  (val) => {
    if (props.mode !== "add") return;

    nextTick(() => {
      try {
        if (val === "Replenish") {
          // prefer Quasar focus API
          if (replenishInput.value && typeof replenishInput.value.focus === "function") {
            replenishInput.value.focus();
            return;
          }
          const el = replenishInput.value?.$el || replenishInput.value;
          const input = el?.querySelector ? el.querySelector("input") : null;
          if (input && typeof input.focus === "function") {
            input.focus();
            return;
          }
        }

        if (val === "Todo" || val === "NoteLater") {
          // focus description textarea/input
          if (
            descriptionInput.value &&
            typeof descriptionInput.value.focus === "function"
          ) {
            descriptionInput.value.focus();
            return;
          }
          const el = descriptionInput.value?.$el || descriptionInput.value;
          const input = el?.querySelector ? el.querySelector("textarea, input") : null;
          if (input && typeof input.focus === "function") {
            input.focus();
            return;
          }
        }

        if (val === "TimeEvent") {
          // focus hour input
          if (hourInput.value && typeof hourInput.value.focus === "function") {
            hourInput.value.focus();
            return;
          }
          const el = hourInput.value?.$el || hourInput.value;
          const input = el?.querySelector ? el.querySelector("input") : null;
          if (input && typeof input.focus === "function") {
            input.focus();
            return;
          }
        }
      } catch (e) {
        // ignore
      }
    });
  }
);

// When parent provides an initialTask, populate localNewTask
watch(
  () => props.initialTask,
  (val) => {
    if (val) {
      // copy relevant fields
      localNewTask.value = {
        name: val.name || "",
        description: val.description || "",
        type_id: val.type_id || "TimeEvent",
        status_id: val.status_id ?? 1,
        parent_id: val.parent_id ?? null,
        created_by: val.created_by || "",
        priority: val.priority || "medium",
        color_set: val.color_set ?? val.colorSet ?? undefined,
        groupId: val.groupId,
        eventDate: val.date || val.eventDate || localNewTask.value.eventDate,
        eventTime: val.eventTime || "",
        timeMode: val.timeMode || "event",
        timeOffsetDays: val.timeOffsetDays == null ? 7 : val.timeOffsetDays,
        id: val.id,
      };
      // Load repeat state from the composable helper
      loadRepeatFromTask(val);
      // Fall back to saved event date for everyNDayOfMonth (covers all cycle types)
      try {
        const savedEv =
          (val.repeat && (val.repeat.eventDate || val.repeat.date)) ||
          val.eventDate ||
          val.date ||
          null;
        if (savedEv) {
          const ds = new Date(savedEv as string);
          if (!isNaN(ds.getTime())) everyNDayOfMonth.value = ds.getDate();
        }
      } catch (e) {
        // ignore
      }
      // Ensure nth-day seed is set even when repeat object is absent
      try {
        if (repeatCycleType.value === "nth" && !everyNDayOfMonth.value) {
          const ev = localNewTask.value.eventDate || props.selectedDate || null;
          if (ev) {
            const d = new Date(ev);
            if (!isNaN(d.getTime())) everyNDayOfMonth.value = d.getDate();
          }
        }
      } catch (e) {
        // ignore
      }

      // Ensure the time-type toggle reflects whether the loaded task has an hour set
      try {
        timeType.value = localNewTask.value.eventTime && String(localNewTask.value.eventTime).trim() !== "" ? "exactHour" : "wholeDay";
        // clear cachedTime when loading an explicit time so toggles behave predictably
        if (timeType.value === "exactHour") {
          cachedTime.value.hour = null;
          cachedTime.value.minute = null;
        }
      } catch (e) {
        void e;
      }

      emit("update:mode", "edit");
    } else {
      // switch back to add mode and reset fields
      emit("update:mode", "add");
      // preserve currently selected type so the chooser doesn't jump back to default
      const prevType =
        lastSelectedType.value || localNewTask.value?.type_id || "TimeEvent";
      // keep date if provided via selectedDate prop
      localNewTask.value = {
        name: "",
        description: "",
        type_id: prevType,
        status_id: 1,
        parent_id: null,
        created_by: "",
        priority: "medium",
        groupId: extractGroupId((props as any).activeGroup),
        eventDate:
          props.selectedDate ||
          `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
        eventTime: "",
        timeMode: "event",
        timeOffsetDays: 7,
      };
      // Reset repeat inputs when clearing the form
      resetRepeat();
    }
  },
  { immediate: true }
);

// Auto-generate name from description (local)
const autoGeneratedName = computed(() => {
  if (!localNewTask.value.description) return "";
  // Take up to a marker ' -' if present (e.g. "Title - details")
  const desc = localNewTask.value.description.trim();
  // Stop title at a newline or at the explicit marker ' -' (whichever comes first)
  const newlineIndex = desc.indexOf("\n");
  let markerIndex = desc.indexOf(" -");
  if (newlineIndex >= 0 && (markerIndex === -1 || newlineIndex < markerIndex)) {
    markerIndex = newlineIndex;
  }
  let head = "";
  if (markerIndex > 0) {
    head = desc.substring(0, markerIndex).trim();
  } else {
    // Take first sentence or first 50 characters
    const firstSentence = desc.split(/[.!?]/)[0] || "";
    head = firstSentence || desc.substring(0, 50);
  }

  const name = head.length > 50 ? head.substring(0, 50) + "..." : head;
  // Capitalize first letter
  const val = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
  return val;
});

// Always keep local name in sync with the auto-generated title from description
watch(autoGeneratedName, (gen) => {
  localNewTask.value.name = gen;
});

function updateTaskField(field: string, value: any) {
  if (field === "eventDateDay") eventDateDay.value = value;
  else if (field === "eventDateMonth") eventDateMonth.value = value;
  else if (field === "eventDateYear") eventDateYear.value = value;
  else {
    (localNewTask.value as any)[field] = value;
  }
}

function onCalendarDateSelect(date: string) {
  localNewTask.value.eventDate = date;
  emit("calendar-date-select", date);
}

// Inline delete confirmation state (matches TasksList behavior)
const showDeleteConfirm = ref(false);

function openDeleteConfirm() {
  if (!localNewTask.value || !localNewTask.value.id) return;
  showDeleteConfirm.value = true;
}

function cancelDeleteConfirm() {
  showDeleteConfirm.value = false;
}

function performDelete() {
  if (!localNewTask.value || !localNewTask.value.id) return;
  emit("delete-task", { id: localNewTask.value.id, date: localNewTask.value.eventDate });
  emit("cancel-edit");
  showDeleteConfirm.value = false;
}

// Sync when parent calendar selection changes
watch(
  () => props.selectedDate,
  (val) => {
    if (val && val !== localNewTask.value.eventDate) {
      localNewTask.value.eventDate = val;
      // When parent changes the selected date (e.g. calendar day click),
      // default new tasks to `TimeEvent` so the TimeEvent chooser is shown.
      try {
        if (props.mode === "add") {
          localNewTask.value.type_id = "TimeEvent";
          lastSelectedType.value = "TimeEvent";
          try {
            localStorage.setItem(STORAGE_KEY, "TimeEvent");
          } catch (e) {
            void e;
          }
        }
      } catch (e) {
        void e;
      }
    }
  }
);

// Keep local group selection in sync with parent's activeGroup, but only when
// the form is in add mode. Do NOT overwrite the group when editing an existing
// task.
watch(
  () => (props as any).activeGroup,
  (val) => {
    try {
      if (props.mode !== "add") return;
      const gid = extractGroupId(val);
      // normalize undefined/null to undefined used in localNewTask
      localNewTask.value.groupId = gid == null ? undefined : gid;
    } catch (e) {
      // ignore
    }
  }
);

// When parent switches the form back into add mode, ensure the group is
// initialized from the activeGroup so the chooser reflects the current context.
watch(
  () => props.mode,
  (m) => {
    try {
      if (m === "add") {
        localNewTask.value.groupId = extractGroupId((props as any).activeGroup);
      }
    } catch (e) {
      // ignore
    }
  }
);
// ...existing code continues...

const priorityOptions = [
  {
    label: "Crit",
    value: "critical",
    icon: "warning",
    background: themePriorityColors.critical,
    textColor: themePriorityTextColor("critical"),
  },
  {
    label: "Hi",
    value: "high",
    icon: "priority_high",
    background: themePriorityColors.high,
    textColor: themePriorityTextColor("high"),
  },
  {
    label: "Med",
    value: "medium",
    icon: "drag_handle",
    background: themePriorityColors.medium,
    textColor: themePriorityTextColor("medium"),
  },
  {
    label: "Lo",
    value: "low",
    icon: "low_priority",
    background: themePriorityColors.low,
    textColor: themePriorityTextColor("low"),
  },
];

// Colors for task types (used to color type buttons when active)
const typeColors: Record<string, string> = {
  TimeEvent: "#2196f3", // blue
  Todo: "#4caf50", // green
  NoteLater: "#9e9e9e", // grey
  Replenish: "#c9a676", // yellow
};

const typeTextColors: Record<string, string> = {
  TimeEvent: "white",
  Todo: "white",
  NoteLater: "white",
  Replenish: "#212121",
};

// Map checkbox to numeric status_id (0 = done, 1 = just created)
const statusValue = computed<number>({
  get: () => (Number(localNewTask.value.status_id) === 0 ? 0 : 1),
  set: (val: number) => {
    // ensure numeric storage; other parts may accept string too
    localNewTask.value.status_id = val;
  },
});

// Rows for description textarea: expand after ~100 characters
const descriptionRows = computed(() => {
  const len = (localNewTask.value.description || "").length;
  return len > 100 ? 8 : 4;
});

// Auto-resize textarea to fit content
const descriptionInput = ref<any>(null);

// When user switches type while in add mode, toggle `stayAfterSave`:
// - enable when switching to Replenish
// - disable when switching away from Replenish
watch(isReplenish, (newVal, oldVal) => {
  try {
    if (props.mode !== "add") return;
    if (newVal && !oldVal) stayAfterSave.value = true;
    else if (!newVal && oldVal) stayAfterSave.value = false;
  } catch (e) {
    // ignore
  }
});
function adjustDescriptionHeight() {
  nextTick(() => {
    try {
      const root = descriptionInput.value?.$el || descriptionInput.value;
      const ta: HTMLTextAreaElement | null = root?.querySelector
        ? root.querySelector("textarea")
        : null;
      if (ta) {
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
      }
    } catch (e) {
      // ignore
    }
  });
}

watch(
  () => localNewTask.value.description,
  () => {
    adjustDescriptionHeight();
  }
);

// Supplement composable's nth-mode handling with the actual current event day
watch(repeatCycleType, (val) => {
  if (val === 'nth' && !everyNDayOfMonth.value) {
    try {
      const dayNum = Number(eventDateDay.value) || null;
      if (dayNum && !isNaN(dayNum)) everyNDayOfMonth.value = dayNum;
    } catch (e) {
      // ignore — composable handles selectedDate fallback
    }
  }
});

onMounted(() => {
  adjustDescriptionHeight();
});

function onSubmit(event: Event) {
  event.preventDefault();
  // Prevent creating Notes — show message instead
  if (localNewTask.value.type_id === "NoteLater") {
    try {
      $q.notify({
        type: "info",
        message: "Notes needs to be redesigned and coded in some future",
      });
    } catch (e) {
      // ignore notify failures
    }
    return;
  }
  // If this is a Replenish task and the user typed a query, use it as the name
  if (
    localNewTask.value.type_id === "Replenish" &&
    replenishQuery.value &&
    replenishQuery.value.trim()
  ) {
    localNewTask.value.name = replenishQuery.value.trim();
    localNewTask.value.status_id = 1; // ensure undone
    // clear the query so subsequent submits don't reuse it
    replenishQuery.value = "";
  }
  // Ensure a name exists: prefer explicit name, otherwise use auto-generated name
  if (!localNewTask.value.name || !localNewTask.value.name.trim()) {
    const generated = autoGeneratedName.value || "";
    if (generated) localNewTask.value.name = generated;
  }
  if (props.mode === "add") {
    const payload: any = { ...localNewTask.value };
    // Canonical repeat object
    payload.repeat = buildRepeatPayload(localNewTask.value.eventDate);
    emit("add-task", payload, { preview: !stayAfterSave.value });
    // Clear the description textarea after adding the task
    localNewTask.value.description = "";
    // Reset status checkbox to '1' (just created)
    try {
      (statusValue as any).value = 1;
    } catch (e) {
      localNewTask.value.status_id = 1;
    }
  } else {
    // Edit mode: build repeat payload and emit update
    const updated = { ...localNewTask.value } as any;
    updated.repeat = buildRepeatPayload(localNewTask.value.eventDate);
    // Emit update; parent will switch to preview and clear edit selection
    emit("update-task", updated);
  }
}
</script>

<template>
  <q-card class="q-mb-md add-task-card" :style="cardStyle">
    <i
      v-if="watermarkIcon"
      class="material-icons add-watermark-text"
      style="
        position: absolute;
        right: 8px;
        bottom: 8px;
        font-size: 320px;
        opacity: 0.28;
        color: rgba(0, 0, 0, 0.14);
        z-index: 1000;
        pointer-events: none;
        transform: rotate(-12deg);
      "
      aria-hidden="true"
    >
      {{ watermarkIcon }}
    </i>
    <div v-if="mode !== 'preview'" class="add-task-group-bar">
      <div class="group-bar-inner">
        <div style="display: inline-block; margin-left: 8px">
          <q-chip
            size="md"
            class="q-pointer group-select-chip"
            clickable
            :style="getGroupChipStyle(localNewTask.groupId)"
            @click.stop="groupMenu = true"
          >
            <q-icon
              :name="getGroupIcon(localNewTask.groupId)"
              :style="{ color: getGroupTextColor(localNewTask.groupId) }"
              class="q-mr-xs"
            />
            {{
              getGroupName(localNewTask.groupId) || activeGroupLabelShort || $text('group.none')
            }}
          </q-chip>
          <q-menu
            v-model="groupMenu"
            anchor="bottom right"
            self="top right"
            class="group-menu"
          >
            <q-list dense separator>
              <q-item clickable dense @click="selectGroupForAdd(null)">
                <q-item-section
                  side
                  style="
                    width: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <q-icon name="clear" />
                </q-item-section>
                <q-item-section>
                  <div style="font-weight: 600">{{$text('group.none')}}</div>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-for="g in groups || []"
                :key="g.id"
                clickable
                dense
                @click="selectGroupForAdd(g.id)"
              >
                <q-item-section
                  side
                  style="
                    width: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <q-icon
                    :name="g.icon || 'folder'"
                    :style="{ color: g.color || 'inherit' }"
                  />
                </q-item-section>
                <q-item-section>
                  <div style="font-weight: 600">{{ g.name }}</div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </div>
      </div>
    </div>
    <q-card-section>
      <div v-if="isReplenish && mode === 'add'" style="margin-bottom: 8px">
        <ReplenishmentList
          :replenish-tasks="smallReplenishTasks"
          :size="'small'"
          @toggle-status="$emit('toggle-status', $event)"
          @edit-task="$emit('edit-task', $event)"
        />
      </div>
      <div
        v-if="mode === 'edit'"
        class="row items-center q-mb-lg"
        style="align-items: center; gap: 6px"
      >
        <div class="text-h6" style="display: flex; align-items: center; gap: 4px">
          <i
            v-if="watermarkIcon"
            class="material-icons"
            style="font-size: 18px; color: #ff9800; line-height: 1"
            aria-hidden="true"
          >
            {{ watermarkIcon }}
          </i>
          <span style="color: #ff9800; font-weight: 600">Edit:</span>
          <span style="font-weight: 500">{{ localNewTask.name || "Untitled" }}</span>
        </div>
        <div style="margin-left: auto; display: flex; gap: 8px; align-items: center">
          <q-btn
            dense
            unelevated
            color="primary"
            icon="visibility"
            :label="$text('action.preview')"
            @click.stop="() => emit('update:mode', 'preview')"
          />
        </div>
      </div>
      <q-form @submit="onSubmit" class="q-gutter-md">
        <!-- Type selector moved into Priority card below; header removed -->

        <!-- Date/time panels relocated into the description column below -->
        <!-- Priority and Type moved into right column below so both remain visible -->
        <div class="row" style="gap: 12px">
          <div class="col column" style="gap: 12px">
            <div>
              <div class="row q-gutter-sm q-mb-md" style="align-items: flex-start">
                <div class="col">
                  <div class="row q-gutter-sm" style="align-items: flex-start">
                    <q-card
                      v-if="localNewTask.type_id === 'TimeEvent'"
                      flat
                      bordered
                      class="q-pa-sm bg-blue-1"
                    >
                      <div
                        class="row items-center q-mb-xs"
                        style="gap: 8px; align-items: center"
                      >
                        <div class="text-caption text-grey-7">{{ $text('label.date') }}</div>

                        <div class="col-auto">
                          <q-btn-toggle
                            v-model="repeatMode"
                            :options="repeatOptions"
                            dense
                            inline
                            rounded
                            class="time-toggle"
                          />
                        </div>
                        <div
                          v-if="repeatMode !== 'cyclic'"
                          class="text-h7 text-primary text-weight-bold"
                        >
                          {{ getTimeDifferenceDisplay(localNewTask.eventDate) }}
                        </div>
                        <div class="col-auto" v-if="repeatMode !== 'cyclic'">
                          <q-checkbox
                            v-model="autoIncrementYear"
                            dense
                            size="xs"
                            :label="$text('label.auto_year')"
                          />
                        </div>
                      </div>
                      <div v-if="repeatMode === 'cyclic'">
                        <div class="q-mb-sm">
                          <q-btn-toggle
                            v-model="repeatCycleType"
                            :options="repeatCycleOptions"
                            dense
                            inline
                            rounded
                            class="time-toggle"
                          />
                        </div>
                        <div v-if="repeatCycleType === 'nth'" class="q-mb-sm">
                          <q-input
                            type="number"
                            :label="$text('label.nth_day')"
                            dense
                            outlined
                            v-model.number="everyNDayOfMonth"
                            min="1"
                            max="31"
                            style="max-width: 120px"
                            placeholder="10"
                            @focus="
                              (e: Event) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                            @click="
                              (e: Event) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                          />
                          <div v-if="everyNDayOfMonth" class="text-caption q-mb-xs">
                            <template v-if="everyNDayOfMonth >= 29">
                              Repeats every month on day {{ everyNDayOfMonth }} (uses the
                              last day of the month when that day doesn't exist).
                            </template>
                            <template v-else>
                              Repeats every month on day {{ everyNDayOfMonth }}.
                            </template>
                          </div>
                        </div>

                        <div v-else-if="repeatCycleType === 'interval'" class="q-mb-sm">
                          <div class="row q-gutter-sm q-mb-xs">
                            <q-btn
                              v-for="v in [14, 28, 30, 365]"
                              :key="v"
                              dense
                              size="sm"
                              :label="String(v)"
                              @click="repeatIntervalDays = v"
                              :unelevated="repeatIntervalDays === v"
                              :outline="repeatIntervalDays !== v"
                            />
                          </div>
                          <q-input
                            type="number"
                            :label="$text('label.cycle_days')"
                            dense
                            outlined
                            v-model.number="repeatIntervalDays"
                            style="max-width: 160px"
                          />
                        </div>

                        <div v-else-if="repeatCycleType === 'dayWeek'" class="q-mt-sm">
                          <div
                            class="row items-center weekday-row"
                            style="gap: 0px; flex-wrap: nowrap; overflow-x: auto"
                          >
                            <q-btn
                              v-for="opt in weekDayOptions"
                              :key="opt.value"
                              dense
                              size="sm"
                              :label="opt.label"
                              :outline="repeatDays.indexOf(opt.value) === -1"
                              :unelevated="repeatDays.indexOf(opt.value) !== -1"
                              @click="toggleDay(opt.value)"
                              class="weekday-btn q-ma-none"
                              :class="{
                                'weekday-btn-selected':
                                  repeatDays.indexOf(opt.value) !== -1,
                              }"
                            />
                          </div>
                          <div
                            class="row"
                            style="gap: 8px; margin-top: 6px; align-items: center"
                          >
                            <q-btn
                              dense
                              flat
                              size="sm"
                              :label="$text('action.check_all')"
                              @click="checkAllDays"
                            />
                            <q-btn
                              dense
                              flat
                              size="sm"
                              :label="$text('action.clear')"
                              @click="clearDays"
                            />
                          </div>
                        </div>
                      </div>

                      <div
                        v-if="!(repeatMode === 'cyclic' && repeatCycleType === 'nth')"
                        class="row q-gutter-xs items-center"
                        style="align-items: center"
                      >
                        <div
                          class="row q-gutter-xs date-inputs-row"
                          style="
                            gap: 8px;
                            align-items: center;
                            flex-wrap: nowrap;
                            overflow-x: auto;
                          "
                        >
                          <q-input
                            ref="dayInput"
                            v-model.number="eventDateDay"
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                            type="number"
                            :label="$text('label.day')"
                            outlined
                            dense
                            min="1"
                            max="31"
                            style="max-width: 80px; min-width: 64px"
                          />
                          <q-input
                            ref="monthInput"
                            v-model.number="eventDateMonth"
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                            type="number"
                            :label="$text('label.month')"
                            outlined
                            dense
                            min="1"
                            max="12"
                            style="max-width: 80px; min-width: 64px"
                          />
                          <q-input
                            ref="yearInput"
                            v-model.number="eventDateYear"
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                            type="number"
                            :label="$text('label.year')"
                            outlined
                            dense
                            style="max-width: 80px; min-width: 64px"
                          />
                        </div>
                        <div class="col"></div>
                      </div>
                      <div class="row items-center q-gutter-xs q-mb-sm">
                        <div class="row q-gutter-xs" style="gap: 8px">
                          <!-- day/month inputs -->
                        </div>
                      </div>
                      <div
                        class="row q-gutter-xs"
                        style="
                          gap: 8px;
                          align-items: center;
                          flex-wrap: nowrap;
                          overflow-x: auto;
                        "
                      >
                        <div
                          style="
                            flex: 0 0 auto;
                            display: flex;
                            gap: 8px;
                            align-items: center;
                          "
                        >
                          <q-input
                            ref="hourInput"
                            v-model="eventTimeHour"
                            type="number"
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                            :label="$text('label.hour')"
                            outlined
                            dense
                            min="0"
                            max="23"
                            style="max-width: 80px; min-width: 64px"
                          />

                          <q-input
                            ref="minuteInput"
                            v-model="eventTimeMinute"
                            type="number"
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                            :label="$text('label.minute')"
                            outlined
                            dense
                            min="0"
                            max="59"
                            style="max-width: 80px; min-width: 64px"
                          />
                        </div>

                        <div style="flex: 0 0 auto">
                          <q-btn-toggle
                            v-model="timeType"
                            :options="timeTypeOptions"
                            dense
                            inline
                            rounded
                            class="time-toggle"
                          />
                        </div>
                      </div>

                      <div class="row q-mt-sm" style="align-items: center; gap: 8px">
                        <div class="col">
                          <q-btn-toggle
                            v-model="eventTimeMode"
                            :options="timeModeOptions"
                            dense
                            inline
                            rounded
                            class="time-toggle"
                          />
                        </div>
                      </div>
                      <div
                        v-if="eventTimeMode !== 'event'"
                        class="row q-mt-xs items-center"
                        style="gap: 8px; align-items: center"
                      >
                        <q-input
                          ref="offsetInput"
                          v-model.number="eventTimeOffsetDays"
                          type="number"
                          :label="$text('label.days_before')"
                          dense
                          outlined
                          style="max-width: 120px"
                          min="0"
                          placeholder="0"
                          @focus="
                            (e) => {
                              const root = offsetInput.value?.$el || offsetInput.value;
                              const inp = root?.querySelector
                                ? root.querySelector('input')
                                : (e.target as HTMLInputElement);
                              if (inp && typeof inp.select === 'function') inp.select();
                            }
                          "
                        />
                        <div class="row" style="gap: 6px; margin-left: 8px">
                          <q-btn
                            v-for="v in [1, 2, 3, 7, 14, 28]"
                            :key="v"
                            dense
                            size="sm"
                            :label="String(v)"
                            @click="setOffsetDays(v)"
                          />
                        </div>
                      </div>
                    </q-card>
                  </div>
                  <br />
                  <div>
                    <div v-if="localNewTask.type_id === 'NoteLater'" class="q-pa-sm col">
                      <q-card flat bordered class="notes-disabled-card q-pa-md">
                        <div class="row items-center" style="gap: 12px">
                          <q-icon name="construction" size="36px" />
                          <div>
                            <div class="text-subtitle1" style="font-weight: 700">
                              Notes disabled
                            </div>
                            <div class="text-body2" style="font-weight: 600">
                              Notes needs to be redesigned and coded in some future
                            </div>
                            <div class="text-caption" style="margin-top: 6px">
                              Under construction — coming later
                            </div>
                          </div>
                        </div>
                      </q-card>
                    </div>
                    <div v-else>
                      <q-input
                        v-if="!isReplenish"
                        ref="descriptionInput"
                        :model-value="localNewTask.description"
                        :label="$text('label.description')"
                        outlined
                        type="textarea"
                        rows="1"
                        class="col"
                        @update:model-value="(val) => updateTaskField('description', val)"
                      />
                      <!-- Title is auto-generated from description; input removed -->

                      <!-- Replenish special field: search existing or create new (moved above submit buttons) -->
                      <div
                        v-if="isReplenish && mode === 'add'"
                        class="q-pa-sm col"
                        style="position: relative"
                      >
                        <div class="text-caption text-grey-7 q-mb-xs">{{ $text('label.replenish') }}</div>
                        <q-input
                          ref="replenishInput"
                          v-model="replenishQuery"
                          @update:model-value="onReplenishInput"
                          @focus="onReplenishFocus"
                          :label="$text('label.search_replenish')"
                          outlined
                          dense
                          class="col"
                        />
                        <div
                          v-if="
                            showReplenishList &&
                            replenishQuery &&
                            replenishQuery.trim() &&
                            replenishMatches.length
                          "
                          class="q-mt-sm"
                          :style="replenishListStyle"
                        >
                          <q-list dense separator>
                            <q-item
                              v-for="m in replenishMatches"
                              :key="m.id"
                              :data-repl-id="m.id"
                              clickable
                              @pointerdown.stop.prevent="handleReplItemPointer(m)"
                              @click.stop.prevent="handleReplItemPointer(m)"
                              class="q-pa-sm bg-white"
                              style="border-radius: 6px; margin-bottom: 6px"
                            >
                              <q-item-section>
                                <div class="text-body1">{{ m.name }}</div>
                              </q-item-section>
                              <q-item-section
                                side
                                style="display: flex; align-items: center"
                              >
                                <q-icon
                                  v-if="replenishAlreadyAdded(m)"
                                  name="check_circle"
                                  :color="(themeTypeColors as any).Replenish || '#c9a676'"
                                  size="18px"
                                  :title="'Already added for selected date'"
                                />
                              </q-item-section>
                            </q-item>
                          </q-list>
                        </div>
                      </div>

                      <!-- Color chooser for Replenish tasks (moved above submit buttons) -->
                      <div
                        v-if="
                          isReplenish && (props.mode === 'add' || props.mode === 'edit')
                        "
                        class="q-pa-sm col"
                      >
                        <div class="text-caption text-grey-7 q-mb-xs">
                          Replenish color
                        </div>
                        <div class="row" style="gap: 8px; align-items: center">
                          <div style="flex: 0 1 auto">
                            <div
                              v-for="(row, ridx) in replenishColorRows"
                              :key="ridx"
                              class="row"
                              style="gap: 8px; align-items: center; margin-bottom: 6px"
                            >
                              <div
                                v-for="cs in row"
                                :key="cs.id"
                                class="row items-center"
                                style="gap: 6px"
                              >
                                <div
                                  class="color-swatch"
                                  :style="
                                    cs.id === 'transparent'
                                      ? {
                                          background: 'transparent',
                                          border:
                                            (localNewTask as any).color_set == null
                                              ? '2px solid #000'
                                              : '1px dashed rgba(0,0,0,0.12)',
                                        }
                                      : {
                                          background: cs.bg,
                                          border:
                                            cs.id === (localNewTask as any).color_set
                                              ? '2px solid #000'
                                              : '1px solid rgba(0,0,0,0.08)',
                                        }
                                  "
                                  @click.stop="
                                    (localNewTask as any).color_set =
                                      cs.id === 'transparent' ? undefined : cs.id
                                  "
                                  :title="cs.id === 'transparent' ? 'Transparent' : cs.id"
                                >
                                  <q-icon
                                    v-if="cs.id === 'transparent'"
                                    name="close"
                                    size="14px"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <!-- removed redundant clear button: transparent swatch unsets color -->
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="priority-container">
                    <!-- <div class="text-caption text-grey-7" style="margin-bottom: 4px">Priority</div> -->
                    <div class="priority-grid">
                      <div
                        v-for="option in priorityOptions.slice().reverse()"
                        :key="option.value"
                        class="priority-item"
                      >
                        <q-btn
                          :color="
                            localNewTask.priority === option.value
                              ? option.background
                              : 'grey-3'
                          "
                          :text-color="
                            localNewTask.priority === option.value
                              ? option.textColor
                              : 'grey-7'
                          "
                          :icon="option.icon"
                          :aria-label="option.label"
                          :size="btnSize"
                          class="priority-btn"
                          @click="updateTaskField('priority', option.value)"
                          :unelevated="localNewTask.priority === option.value"
                          :outline="localNewTask.priority !== option.value"
                          :style="{
                            backgroundColor:
                              localNewTask.priority === option.value
                                ? option.background
                                : undefined,
                            color:
                              localNewTask.priority === option.value
                                ? option.textColor
                                : undefined,
                          }"
                        />
                      </div>
                    </div>
                  </div>
                  <div class="row" style="gap: 12px; align-items: center">
                    <div class="col-auto">
                      <div class="row items-center" style="gap: 12px">
                        <q-btn
                          type="submit"
                          unelevated
                          :icon="submitIcon || undefined"
                          :label="mode === 'add' ? $text('action.create') : mode === 'edit' ? $text('action.update') : $text('action.preview')"
                          :disable="mode === 'preview'"
                          :style="`background: ${submitColor} !important; background-color: ${submitColor} !important; border-color: ${submitColor} !important; color: ${submitTextColor} !important;`"
                        />

                        <q-btn
                          v-if="mode === 'edit'"
                          flat
                          :label="$text('action.cancel')"
                          class="q-ml-sm"
                          @click="() => emit('cancel-edit')"
                        />
                        <q-checkbox
                          v-model="statusValue"
                          :true-value="0"
                          :false-value="1"
                          dense
                          :label="$text('action.done')"
                          class="q-ml-sm"
                        />
                        <q-checkbox
                          v-if="mode === 'add'"
                          v-model="stayAfterSave"
                          dense
                          class="q-ml-sm"
                          :label="$text('action.stay_after_save')"
                        />
                        <div v-if="mode === 'edit'" class="q-ml-sm">
                          <q-btn
                            flat
                            color="negative"
                            icon="delete"
                            :label="$text('action.remove')"
                            @click.stop="openDeleteConfirm"
                          />
                          <div
                            v-if="showDeleteConfirm"
                            class="row items-center"
                            style="gap: 8px; display: inline-flex; margin-left: 8px"
                          >
                            <div>{{$text('confirm.delete')}}</div>
                            <q-btn flat dense color="negative" :label="$text('action.yes')" @click.stop="performDelete" />
                            <q-btn flat dense :label="$text('action.no')" @click.stop="cancelDeleteConfirm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Priority and Type column to the right of date/time -->
                <div class="col-3 col-md-3 col-sm-3 col-xs-3">
                  <q-card class="q-pa-sm">
                    <div class="text-caption text-grey-7 q-mb-xs">{{ $text('label.task_type') }}</div>
                    <div class="column">
                      <q-btn
                        v-for="opt in typeOptions"
                        :key="opt.value"
                        :label="opt.shortLabel"
                        :aria-label="opt.label"
                        :icon="opt.icon"
                        :size="btnSize"
                        class="full-width type-btn q-mb-sm"
                        :outline="localNewTask.type_id !== opt.value"
                        :unelevated="localNewTask.type_id === opt.value"
                        @click="localNewTask.type_id = opt.value"
                        :style="{
                          backgroundColor:
                            localNewTask.type_id === opt.value
                              ? typeColors[opt.value]
                              : undefined,
                          color:
                            localNewTask.type_id === opt.value
                              ? typeTextColors[opt.value]
                              : undefined,
                        }"
                      />
                    </div>
                  </q-card>
                </div>
              </div>
            </div>

            <!-- Replenish inputs moved above submit buttons -->
          </div>
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<style scoped>
/* Replenishment sizing now handled by ReplenishmentList component via `size` prop */
.add-task-card {
  position: relative;
  overflow: unset;
  overflow-y: unset; /* allow absolute positioned group bar to show; watermark sizing constrained */
}

/* Absolute group selector bar that uses free space above the main form */
.add-task-group-bar {
  position: absolute;
  top: -26px;
  left: 16px;
  right: 16px;
  height: 44px;
  display: flex;
  align-items: center;
  z-index: 6;
  pointer-events: auto;
}
.add-task-group-bar .group-bar-inner {
  background: transparent;
  backdrop-filter: none;
  padding: 0;
  border-radius: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  box-shadow: none;
}
/* larger chip for group selection inside the top bar */
.group-select-chip {
  font-size: 1rem;
  padding: 6px 12px;
  min-width: 120px;
}
.add-watermark-text {
  position: absolute;
  right: 8px;
  bottom: 8px;
  font-family: "Material Icons";
  font-size: 260px;
  opacity: 0.14;
  color: rgba(0, 0, 0, 0.1);
  transform: rotate(-12deg);
  pointer-events: none;
  z-index: 1; /* sits above card background but below inputs */
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  max-width: calc(100vw - 48px);
  overflow: hidden;
}
.add-watermark-icon[data-v-] {
  /* ensure scoped styles apply to q-icon inner element */
}
/* ensure card content sits above watermark */
.add-task-card > .q-card__section {
  position: relative;
  z-index: 3;
}
.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
}

/* Reduce button min-width/padding for priority buttons so two columns fit on md */
.priority-btn {
  min-width: 0 !important;
  box-sizing: border-box !important;
  padding-left: 4px !important;
  padding-right: 4px !important;
}
.priority-btn .q-btn__content {
  justify-content: center !important;
}
.priority-btn .q-icon {
  margin-right: 4px !important;
}

/* Make the priority card background transparent so it doesn't appear as a white box */
.priority-container {
  background: transparent !important;
  padding: 8px 0 8px 0 !important;
  margin: 0px 0 0 0 !important;
}
/* Make priority container use full available row width */
.priority-container {
  width: 100%;
}

/* Preserve original styling for task type buttons (separate from priority buttons) */
.type-btn {
  min-width: 0 !important;
  box-sizing: border-box !important;
  padding-left: 8px !important;
  padding-right: 8px !important;
  width: 100%;
  padding-top: 8px !important;
  padding-bottom: 6px !important;
}
.type-btn .q-btn__content {
  justify-content: center !important;
}
.type-btn .q-icon {
  margin-right: 6px !important;
}

/* Ensure the inner content of type buttons is centered and stacked like before */
:deep(.type-btn .q-btn__content) {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 2px !important;
}
:deep(.type-btn .q-btn__content .q-icon) {
  margin-right: 0 !important;
  margin-top: 6px !important;
  margin-bottom: 2px !important;
  font-size: 22px !important;
}
:deep(.type-btn .q-btn__label) {
  font-size: 13px !important;
  line-height: 1 !important;
}

/* Grid for priority buttons: 1 column on small, 2 columns on md+ */
.priority-grid {
  display: flex;
  flex-direction: row;
  gap: 6px;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  overflow: visible;
  flex-wrap: wrap;
  padding: 0;
  margin-top: 0px;
  margin-bottom: 0px;
}
@media (min-width: 960px) {
  .priority-grid {
    gap: 8px;
  }
}
.priority-item {
  display: inline-block;
}
.priority-item .q-btn {
  width: auto;
  min-width: 36px;
}

/* On medium+ screens make priority buttons grow to fill the row evenly */
@media (min-width: 600px) {
  .priority-grid {
    flex-wrap: nowrap;
  }
  .priority-item {
    flex: 1 1 0;
  }
  .priority-item .q-btn {
    width: 100%;
    min-width: 0;
  }
}
/* Keep border/padding stable on active/outline state to avoid layout shifts */
.priority-item .q-btn {
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
  box-sizing: border-box !important;
  padding-left: 6px !important;
  padding-right: 6px !important;
}
.priority-btn.q-btn--active,
.priority-btn.q-btn--unelevated {
  border-color: transparent !important;
  box-shadow: none !important;
  transform: none !important;
}

/* Notes disabled card styling (orange + black, under construction) */
.notes-disabled-card {
  background: linear-gradient(180deg, #ffb74d 0%, #ff9800 100%);
  color: #000000;
  border: 2px dashed rgba(0, 0, 0, 0.6) !important;
}
.notes-disabled-card .q-icon {
  color: #000000;
}
.notes-disabled-card .text-subtitle1,
.notes-disabled-card .text-body2,
.notes-disabled-card .text-caption {
  color: #000000 !important;
}
.notes-disabled-card {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

/* Stack icon above label for priority buttons on md+ and center them */
:deep(.priority-btn .q-btn__content) {
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px !important;
}
:deep(.priority-btn .q-btn__content .q-icon) {
  margin-right: 0 !important;
  margin-bottom: 2px !important;
}
/* priority labels removed — using icons only for compact display */

/* Reduce visual weight of priority buttons to fit a single row */
.priority-btn {
  padding-left: 6px !important;
  padding-right: 6px !important;
  min-width: 36px !important;
  height: auto !important;
  min-height: 40px !important;
  position: relative !important;
  overflow: visible !important;
}
.priority-btn .q-icon {
  font-size: 18px !important;
  margin-bottom: 2px !important;
}

/* Small adjustments for the time type toggle inside date/time card */
.time-toggle {
  --q-btn-padding: 4px 6px;
}
.time-toggle .q-btn__content {
  gap: 2px;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}

/* Unselected: white buttons with border for contrast on blue card */
.time-toggle .q-btn {
  background: #ffffff !important;
  color: var(--q-color-primary) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  text-transform: capitalize !important;
  font-size: 12px !important;
  padding-left: 8px !important;
  padding-right: 8px !important;
  min-width: 0 !important;
}
.time-toggle .q-btn .q-icon {
  color: var(--q-color-primary) !important;
}
.time-toggle .q-icon {
  font-size: 18px !important;
  width: auto !important;
  height: auto !important;
  margin-right: 0 !important;
  margin-bottom: 6px !important;
}

/* Active/selected */
.time-toggle .q-btn.q-btn--active,
.time-toggle .q-btn.q-btn--active.q-btn--unelevated,
.time-toggle .q-btn.q-btn--active.q-btn--flat {
  background-color: var(--q-color-primary) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.time-toggle .q-btn.q-btn--active .q-icon {
  color: inherit !important;
}

/* Use deep selectors to override Quasar internals if needed */
:deep(.time-toggle .q-btn__content),
:deep(.time-toggle .q-btn__content .q-btn__label) {
  font-size: 12px !important;
  line-height: 1 !important;
  padding: 0 !important;
  text-transform: none !important;
}
:deep(.time-toggle .q-btn__content .q-icon),
:deep(.time-toggle .q-icon) {
  font-size: 18px !important;
  width: auto !important;
  height: auto !important;
  margin: 0 0 6px 0 !important;
  display: block !important;
}

/* Extra override: ensure no inherited margin on q-icon inside time-toggle buttons */
:deep(.time-toggle .q-btn__content .q-icon:not([style])) {
  margin: 0 !important;
}
/* repeat toggle uses the same styles as .time-toggle */

/* Weekday multiselect selected state - target QBtn root and internal content for stronger specificity */
/* Compact weekday button spacing */
.weekday-row {
  -webkit-overflow-scrolling: touch;
  gap: 0px !important;
}
.weekday-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin: 0 !important;
  padding-left: 4px !important;
  padding-right: 4px !important;
  min-width: 30px !important;
  height: 30px !important;
}
.weekday-btn .q-btn__content {
  padding: 0 2px !important;
}

/* Make only first and last weekday buttons rounded */
:deep(.weekday-row .q-btn) {
  border-radius: 0 !important;
}
:deep(.weekday-row .q-btn:first-child) {
  border-top-left-radius: 6px !important;
  border-bottom-left-radius: 6px !important;
}
:deep(.weekday-row .q-btn:last-child) {
  border-top-right-radius: 6px !important;
  border-bottom-right-radius: 6px !important;
}

:deep(.q-btn.weekday-btn-selected),
:deep(button.q-btn.weekday-btn-selected),
:deep(.q-btn.weekday-btn-selected.q-btn--unelevated) {
  background-color: var(--q-color-primary, #1976d2) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
:deep(.q-btn.weekday-btn-selected .q-btn__content),
:deep(button.q-btn.weekday-btn-selected .q-btn__content) {
  background-color: transparent !important;
  color: inherit !important;
}
:deep(.q-btn.weekday-btn-selected .q-icon),
:deep(button.q-btn.weekday-btn-selected .q-icon) {
  color: inherit !important;
}

/* Ensure form inputs have a white background within this component */
:deep(.q-field__control) {
  background: #ffffff !important;
  border-radius: 6px !important;
}

/* Ensure textarea/input elements inherit white background for readability */
:deep(textarea),
:deep(input) {
  background: transparent !important;
}

/* Make radio-like buttons (btn-toggles and priority/type buttons) use white background by default when NOT active.
   Do not use !important so active/selected rules can override this default. */
:deep(.q-btn-toggle .q-btn:not(.q-btn--active)),
:deep(.time-toggle .q-btn:not(.q-btn--active)),
:deep(.priority-btn.q-btn:not(.q-btn--active)) {
  background: #ffffff;
  color: inherit;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

/* Restore outline button ::before borders inside the task form.
   app.scss globally sets .q-btn--outline::before { border-color: transparent }
   to prevent color bleed on the group-select header buttons. Re-enable the
   border here so type-selector, weekday and interval preset buttons show
   their outlines when unselected. */
:deep(.q-btn--outline::before) {
  border-color: currentColor !important;
}
/* Priority buttons (.priority-btn) are kept borderless — they use a transparent
   border placeholder to prevent layout shifts between selected/unselected. */
:deep(.priority-btn.q-btn--outline::before) {
  border-color: transparent !important;
}
</style>
