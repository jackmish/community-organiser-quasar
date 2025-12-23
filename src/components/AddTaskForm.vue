<script setup lang="ts">
import { computed, ref, nextTick, watch, defineProps, defineEmits, onMounted } from "vue";
import CalendarView from "./CalendarView.vue";
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  formatEventHoursDiff,
} from "./theme";

const props = defineProps({
  filteredParentOptions: {
    type: Array,
    default: () => [],
  },
  activeGroup: {
    type: Object as () => { label: string; value: string | null } | null,
    default: null,
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
  "replenish-restore",
]);

// Input refs
const dayInput = ref<any>(null);
const monthInput = ref<any>(null);
const yearInput = ref<any>(null);
const hourInput = ref<any>(null);
const minuteInput = ref<any>(null);
// Auto-increment year checkbox state
const autoIncrementYear = ref(true);

// Time type radio (Whole Day / Exact Hour)
const timeType = ref<"wholeDay" | "exactHour">("wholeDay");

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
  // Optional id when editing an existing task
  id?: string;
  groupId: string | undefined;
  eventDate: string;
  eventTime: string;
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
});

// Mode is controlled by parent via prop `mode` and `update:mode` emit
import { toRef } from "vue";
const modeRef = toRef(props, "mode") as any;
// Friendly label for current mode (match ModeSwitcher labels)
const modeLabel = computed(() => {
  return props.mode === "add"
    ? "Add new thing"
    : props.mode === "edit"
    ? "Edit thing"
    : "Preview";
});

// Type options for task type selector (local only)
const typeOptions = [
  { label: "Time Event", value: "TimeEvent", icon: "event" },
  { label: "TODO", value: "Todo", icon: "check_box" },
  { label: "Replenish", value: "Replenish", icon: "autorenew" },
  { label: "Note/Later", value: "NoteLater", icon: "description" },
];

// Replenish helper state
const replenishQuery = ref("");
const selectedReplenishId = ref<string | null>(null);

const replenishMatches = computed<any[]>(() => {
  const q = (replenishQuery.value || "").toLowerCase().trim();
  if (!q) return (props.allTasks || []).filter((t: any) => t.type_id === "Replenish");
  return (props.allTasks || [])
    .filter((t: any) => t.type_id === "Replenish")
    .filter((t: any) => (t.name || "").toLowerCase().indexOf(q) !== -1);
});

function selectReplenishMatch(t: any) {
  selectedReplenishId.value = t.id;
  replenishQuery.value = t.name || "";
}

function restoreSelectedReplenish() {
  if (!selectedReplenishId.value) return;
  emit("replenish-restore", selectedReplenishId.value);
}

function createReplenishFromInput() {
  const name = (replenishQuery.value || "").trim();
  if (!name) return;
  // set name and emit add-task like normal submit
  localNewTask.value.name = name;
  emit("add-task", { ...localNewTask.value });
  // reset some fields similar to onSubmit
  localNewTask.value.description = "";
}

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
        groupId: val.groupId,
        eventDate: val.date || val.eventDate || localNewTask.value.eventDate,
        eventTime: val.eventTime || "",
        id: val.id,
      } as TaskType;
      emit("update:mode", "edit");
    } else {
      // switch back to add mode and reset fields
      emit("update:mode", "add");
      // keep date if provided via selectedDate prop
      localNewTask.value = {
        name: "",
        description: "",
        type_id: "TimeEvent",
        status_id: 1,
        parent_id: null,
        created_by: "",
        priority: "medium",
        groupId: props.activeGroup?.value ?? undefined,
        eventDate:
          props.selectedDate ||
          `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
        eventTime: "",
      } as TaskType;
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

// Auto-title toggle: when true the task name follows the auto-generated title
const autoTitleEnabled = ref(true);

// When initialTask is set we prefer manual title (don't overwrite existing name)
watch(
  () => props.initialTask,
  (val) => {
    if (val) {
      autoTitleEnabled.value = false;
    } else {
      autoTitleEnabled.value = true;
    }
  },
  { immediate: true }
);

// Keep local name in sync when auto-title is enabled
watch([autoGeneratedName, autoTitleEnabled], ([gen, enabled]) => {
  if (enabled) {
    localNewTask.value.name = gen;
  }
});

// Computed for eventTime hour and minute
const eventTimeHour = computed(() => {
  if (!localNewTask.value.eventTime) return "";
  const val = Number(localNewTask.value.eventTime.split(":")[0]);
  console.log("[computed] eventTimeHour", val);
  return val;
});
const eventTimeMinute = computed(() => {
  if (!localNewTask.value.eventTime) return "";
  const val = Number(localNewTask.value.eventTime.split(":")[1]);
  console.log("[computed] eventTimeMinute", val);
  return val;
});

// Compute hour difference between now and the full event datetime when exact hour is set
const eventDateTimeHoursDiff = computed<number | null>(() => {
  const dateStr = localNewTask.value.eventDate;
  const timeStr = localNewTask.value.eventTime; // expected "HH:MM"
  if (!dateStr || !timeStr) return null;
  // Construct a local datetime string
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  if (isNaN(dt.getTime())) return null;
  const now = new Date();
  const diffHours = (dt.getTime() - now.getTime()) / (1000 * 60 * 60);
  return diffHours;
});

const eventTimeHoursDisplay = computed(() => {
  return formatEventHoursDiff(localNewTask.value.eventDate, localNewTask.value.eventTime);
});

// Watch timeType to clear/restore time when toggling modes
const cachedTime = ref<{ hour: string | number; minute: string | number }>({
  hour: "",
  minute: "",
});
watch(timeType, (newValue, oldValue) => {
  if (newValue === "wholeDay") {
    cachedTime.value.hour = eventTimeHour.value;
    cachedTime.value.minute = eventTimeMinute.value;
    localNewTask.value.eventTime = "";
  } else if (oldValue === "wholeDay" && newValue === "exactHour") {
    const hour = cachedTime.value.hour || 0;
    const minute = cachedTime.value.minute || 0;
    localNewTask.value.eventTime = `${String(hour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")}`;
  }
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

// Sync when parent calendar selection changes
watch(
  () => props.selectedDate,
  (val) => {
    if (val && val !== localNewTask.value.eventDate) {
      localNewTask.value.eventDate = val;
    }
  }
);
// ...existing code continues...

// Helper: format date as yyyy-MM-dd
function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Update handlers with auto-advance and auto-increment logic
const isUpdatingDate = ref(false);
function updateEventDateDay(val: number | string | null) {
  if (val === null || val === "" || isUpdatingDate.value) return;
  isUpdatingDate.value = true;
  try {
    const day = Number(val);
    if (isNaN(day) || day < 1 || day > 31) return;
    const year = eventDateYear.value;
    const month = eventDateMonth.value;
    // Always update full date string
    eventDateDay.value = day;
    // Auto-focus to month input after filling day (when day is 2 digits)
    if (String(val).length >= 2) {
      setTimeout(() => {
        monthInput.value?.$el?.querySelector("input")?.focus();
      }, 0);
    }
  } finally {
    isUpdatingDate.value = false;
  }
}

function updateEventDateMonth(val: number | string | null) {
  if (val === null || val === "" || isUpdatingDate.value) return;
  isUpdatingDate.value = true;
  try {
    const month = Number(val);
    if (isNaN(month) || month < 1 || month > 12) return;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let year = eventDateYear.value;
    const day = eventDateDay.value;
    // Auto-increment year if enabled and month < current month
    if (autoIncrementYear.value) {
      if (month < currentMonth && year === currentYear) {
        year = currentYear + 1;
      }
      // If user corrects to month >= currentMonth and year was incremented, revert year
      if (month >= currentMonth && year === currentYear + 1) {
        year = currentYear;
      }
    }
    // Always update full date string using computed setter
    const newDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
    localNewTask.value.eventDate = newDate;
    // Auto-focus to hour input after filling month (when month is 2 digits)
    if (String(val).length >= 2) {
      setTimeout(() => {
        hourInput.value?.$el?.querySelector("input")?.focus();
      }, 0);
    }
  } finally {
    isUpdatingDate.value = false;
  }
}

function updateEventDateYear(val: number | string | null) {
  if (val === null || val === "") return;
  eventDateYear.value = Number(val);
}

function updateEventTimeHour(val: number | string | null) {
  if (val === null || val === "") return;
  const hour = Number(val);
  if (isNaN(hour) || hour < 0 || hour > 23) return;
  timeType.value = "exactHour";
  const minute = eventTimeMinute.value || 0;
  // Update eventTime string in newTask
  const eventTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  localNewTask.value.eventTime = eventTime;
  // Auto-focus to minute input after filling hour (when hour is 2 digits)
  if (String(val).length >= 2) {
    setTimeout(() => {
      minuteInput.value?.$el?.querySelector("input")?.focus();
    }, 0);
  }
}

function updateEventTimeMinute(val: number | string | null) {
  if (val === null || val === "") return;
  const minute = Number(val);
  if (isNaN(minute) || minute < 0 || minute > 59) return;
  timeType.value = "exactHour";
  const hour = eventTimeHour.value || 0;
  // Update eventTime string in newTask
  const eventTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  localNewTask.value.eventTime = eventTime;
}

// Returns a human-readable difference between the given date and today
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
// Computed for eventDate parts, always in sync with eventDate
const eventDate = computed(() => {
  const val = localNewTask.value.eventDate || "";
  console.log("[computed] eventDate", val);
  return val;
});
const eventDateParts = computed(() => {
  const val = eventDate.value.split("-");
  console.log("[computed] eventDateParts", val);
  return val;
});
const eventDateYear = computed({
  get: () => {
    const val = eventDateParts.value[0]
      ? Number(eventDateParts.value[0])
      : new Date().getFullYear();
    console.log("[computed] eventDateYear", val);
    return val;
  },
  set: (val: number) => {
    if (eventDateParts.value.length === 3) {
      localNewTask.value.eventDate = `${val}-${eventDateParts.value[1]}-${eventDateParts.value[2]}`;
    }
  },
});
const eventDateMonth = computed({
  get: () => {
    const val = eventDateParts.value[1]
      ? Number(eventDateParts.value[1])
      : new Date().getMonth() + 1;
    console.log("[computed] eventDateMonth", val);
    return val;
  },
  set: (val: number) => {
    if (eventDateParts.value.length === 3) {
      localNewTask.value.eventDate = `${eventDateParts.value[0]}-${String(val).padStart(
        2,
        "0"
      )}-${eventDateParts.value[2]}`;
    }
  },
});
const eventDateDay = computed({
  get: () => {
    const val = eventDateParts.value[2]
      ? Number(eventDateParts.value[2])
      : new Date().getDate();
    console.log("[computed] eventDateDay", val);
    return val;
  },
  set: (val: number) => {
    if (eventDateParts.value.length === 3) {
      localNewTask.value.eventDate = `${eventDateParts.value[0]}-${
        eventDateParts.value[1]
      }-${String(val).padStart(2, "0")}`;
    }
  },
});
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
  Replenish: "#ffb300", // amber
};

const typeTextColors: Record<string, string> = {
  TimeEvent: "white",
  Todo: "white",
  NoteLater: "white",
  Replenish: "white",
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

onMounted(() => {
  adjustDescriptionHeight();
});

function onSubmit(event: Event) {
  event.preventDefault();
  // Ensure a name exists: prefer explicit name, otherwise use auto-generated name
  if (!localNewTask.value.name || !localNewTask.value.name.trim()) {
    const generated = autoGeneratedName.value || "";
    if (generated) localNewTask.value.name = generated;
  }
  if (props.mode === "add") {
    console.log("[emit] add-task", { ...localNewTask.value });
    emit("add-task", { ...localNewTask.value });
    // Clear the description textarea after adding the task
    localNewTask.value.description = "";
    // Reset status checkbox to '1' (just created)
    try {
      (statusValue as any).value = 1;
    } catch (e) {
      localNewTask.value.status_id = 1;
    }
  } else {
    // Edit mode: emit update and switch back to add mode
    console.log("[emit] update-task", { ...localNewTask.value });
    emit("update-task", { ...localNewTask.value });
    // reset form to add defaults
    emit("update:mode", "add");
    // notify parent to clear its edit selection
    emit("cancel-edit");
  }
}
</script>

<template>
  <q-card class="q-mb-md">
    <q-card-section>
      <q-form @submit="onSubmit" class="q-gutter-md">
        <!-- Type selector moved into Priority card below; header removed -->

        <!-- Date/time panels relocated into the description column below -->
        <!-- Priority and Type moved into right column below so both remain visible -->
        <div class="row" style="gap: 12px">
          <div class="col column" style="gap: 12px">
            <div v-if="localNewTask.type_id === 'TimeEvent'">
              <CalendarView
                v-if="showCalendar && localNewTask.type_id === 'TimeEvent'"
                :selected-date="localNewTask.eventDate"
                @update:selected-date="onCalendarDateSelect"
              />
              <div class="row q-gutter-sm q-mb-md">
                <q-card flat bordered class="q-pa-sm col-auto">
                  <div class="text-caption text-grey-7 q-mb-xs">Date</div>
                  <div class="row q-gutter-xs">
                    <q-input
                      ref="dayInput"
                      :model-value="eventDateDay"
                      @update:model-value="updateEventDateDay"
                      @focus="(e) => (e.target as HTMLInputElement)?.select && (e.target as HTMLInputElement).select()"
                      type="number"
                      label="Day"
                      outlined
                      dense
                      min="1"
                      max="31"
                      style="max-width: 80px"
                    />
                    <q-input
                      ref="monthInput"
                      :model-value="eventDateMonth"
                      @update:model-value="updateEventDateMonth"
                      @focus="(e) => (e.target as HTMLInputElement)?.select && (e.target as HTMLInputElement).select()"
                      type="number"
                      label="Month"
                      outlined
                      dense
                      min="1"
                      max="12"
                      style="max-width: 80px"
                    />
                  </div>
                  <br />
                  <q-option-group
                    v-model="timeType"
                    :options="[
                      { label: 'Whole Day', value: 'wholeDay' },
                      { label: 'Exact Hour', value: 'exactHour' },
                    ]"
                    color="primary"
                    inline
                    dense
                    class="q-mb-sm"
                  />
                  <div class="row q-gutter-xs">
                    <div class="column" style="max-width: 80px">
                      <q-input
                        ref="hourInput"
                        :model-value="eventTimeHour"
                        @update:model-value="updateEventTimeHour"
                        type="number"
                        label="Hour"
                        outlined
                        dense
                        min="0"
                        max="23"
                        style="max-width: 80px"
                      />
                      <div
                        v-if="eventTimeHoursDisplay"
                        class="text-caption text-grey-7 q-mt-xs"
                      >
                        {{ eventTimeHoursDisplay }}
                      </div>
                    </div>
                    <q-input
                      ref="minuteInput"
                      :model-value="eventTimeMinute"
                      @update:model-value="updateEventTimeMinute"
                      type="number"
                      label="Minute"
                      outlined
                      dense
                      min="0"
                      max="59"
                      style="max-width: 80px"
                    />
                  </div>
                </q-card>

                <q-card flat bordered class="q-pa-sm col-auto">
                  <div class="row items-center justify-between q-mb-xs">
                    <div class="text-caption text-grey-7">Year</div>
                    <q-checkbox
                      v-model="autoIncrementYear"
                      dense
                      size="xs"
                      label="Auto"
                    />
                  </div>
                  <q-input
                    ref="yearInput"
                    :model-value="eventDateYear"
                    @update:model-value="updateEventDateYear"
                    type="number"
                    label="Year"
                    outlined
                    dense
                    style="max-width: 100px"
                  />
                  <div class="text-caption text-grey-7 q-mb-xs">Time Difference</div>
                  <div class="text-h6 text-primary text-weight-bold">
                    {{ getTimeDifferenceDisplay(localNewTask.eventDate) }}
                  </div>
                </q-card>
              </div>
            </div>

            <q-input
              ref="descriptionInput"
              :model-value="localNewTask.description"
              label="Description"
              outlined
              type="textarea"
              rows="1"
              class="col"
              @update:model-value="(val) => updateTaskField('description', val)"
            />
          </div>
          <div class="col column" style="gap: 12px">
            <div class="row q-gutter-sm" style="align-items: flex-start">
              <q-card flat bordered class="q-pa-sm col" style="min-width: 160px">
                <div class="text-caption text-grey-7 q-mb-xs">Priority</div>
                <div class="column q-gutter-xs">
                  <q-btn
                    v-for="option in priorityOptions"
                    :key="option.value"
                    :color="
                      localNewTask.priority === option.value
                        ? option.background
                        : 'grey-3'
                    "
                    :text-color="
                      localNewTask.priority === option.value ? option.textColor : 'grey-7'
                    "
                    :icon="option.icon"
                    :label="option.label"
                    size="md"
                    class="full-width"
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
              </q-card>
              <!-- Replenish special field: search existing or create new -->
              <div
                v-if="localNewTask.type_id === 'Replenish' && mode === 'add'"
                class="q-pa-sm col"
              >
                <div class="text-caption text-grey-7 q-mb-xs">Replenish</div>
                <q-input
                  v-model="replenishQuery"
                  label="Search existing Replenish or type a new title"
                  outlined
                  dense
                  class="col"
                />
                <div v-if="replenishMatches.length" class="q-mt-sm">
                  <q-list dense>
                    <q-item
                      v-for="m in replenishMatches"
                      :key="m.id"
                      clickable
                      @click="selectReplenishMatch(m)"
                    >
                      <q-item-section>
                        <div>{{ m.name }}</div>
                        <div class="text-caption text-grey-6">
                          {{ m.date || m.eventDate || "" }}
                        </div>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
                <div class="row q-gutter-sm q-mt-sm">
                  <q-btn
                    label="Restore selected"
                    color="orange"
                    :disable="!selectedReplenishId"
                    @click="restoreSelectedReplenish"
                  />
                  <q-btn
                    label="Create new from input"
                    color="positive"
                    @click="createReplenishFromInput"
                  />
                </div>
              </div>

              <q-card flat bordered class="q-pa-sm col" style="min-width: 160px">
                <div class="text-caption text-grey-7 q-mb-xs">Type</div>
                <div class="column q-gutter-xs">
                  <q-btn
                    v-for="opt in typeOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :icon="opt.icon"
                    size="md"
                    class="full-width"
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

            <div class="row items-center" style="gap: 8px">
              <q-checkbox v-model="autoTitleEnabled" dense label="Auto" />
              <q-input
                v-model="localNewTask.name"
                :placeholder="
                  autoTitleEnabled
                    ? autoGeneratedName || 'Automatic title'
                    : 'Enter task name'
                "
                :readonly="autoTitleEnabled"
                label="Task name"
                outlined
                class="col"
                @update:model-value="
                  (val) => {
                    if (!autoTitleEnabled && val && typeof val === 'string') {
                      updateTaskField('name', val.charAt(0).toUpperCase() + val.slice(1));
                    }
                  }
                "
              />
            </div>
          </div>
        </div>
        <div class="row" style="gap: 12px; align-items: center">
          <div class="col-auto">
            <div class="row items-center" style="gap: 12px">
              <q-btn
                type="submit"
                color="primary"
                :label="
                  mode === 'add'
                    ? 'Add Task'
                    : mode === 'edit'
                    ? 'Save Changes'
                    : 'Preview'
                "
                :disable="mode === 'preview'"
              />
              <q-btn
                v-if="mode === 'edit'"
                flat
                label="Cancel"
                class="q-ml-sm"
                @click="() => emit('cancel-edit')"
              />
              <q-checkbox
                v-model="statusValue"
                :true-value="0"
                :false-value="1"
                dense
                label="Done"
                class="q-ml-sm"
              />
              <div
                v-if="activeGroup && activeGroup.value"
                class="text-caption text-grey-7 q-ml-md"
              >
                <q-icon name="info" size="xs" class="q-mr-xs" />
                Task will be added to:
                <strong>{{ activeGroup.label.split(" (")[0] }}</strong>
              </div>
            </div>
          </div>
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>
