<script setup lang="ts">
import {
  computed,
  ref,
  nextTick,
  watch,
  defineProps,
  defineEmits,
  onMounted,
  onBeforeUnmount,
} from 'vue';
import { toRef } from 'vue';
import { useQuasar } from 'quasar';
import CalendarView from './CalendarView.vue';
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  formatEventHoursDiff,
} from './theme';

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
    default: '',
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
    default: 'add',
  },
});
const emit = defineEmits([
  'add-task',
  'update-task',
  'cancel-edit',
  'calendar-date-select',
  'filter-parent-tasks',
  'update:mode',
  'replenish-restore',
]);

// Input refs
const dayInput = ref<any>(null);
const monthInput = ref<any>(null);
const yearInput = ref<any>(null);
const hourInput = ref<any>(null);
const minuteInput = ref<any>(null);
const replenishInput = ref<any>(null);
// Auto-increment year checkbox state
const autoIncrementYear = ref(true);

// Time type radio (Whole Day / Exact Hour)
const timeType = ref<'wholeDay' | 'exactHour'>('wholeDay');

// Local newTask state, default to today
const today = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
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
  name: '',
  description: '',
  type_id: 'TimeEvent',
  // default to '1' = just created
  // default to 1 = just created (use numeric codes, not boolean)
  status_id: 1,
  parent_id: null,
  created_by: '',
  priority: 'medium',
  groupId: undefined,
  eventDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
  eventTime: '',
});

// Mode is controlled by parent via prop `mode` and `update:mode` emit
const modeRef = toRef(props, 'mode') as any;
// Friendly label for current mode (match ModeSwitcher labels)
const modeLabel = computed(() => {
  return props.mode === 'add' ? 'Add new thing' : props.mode === 'edit' ? 'Edit thing' : 'Preview';
});

// Quasar screen for responsive button sizing
const $q = useQuasar();
const btnSize = computed(() => ($q.screen.gt.sm ? 'md' : 'sm'));
const isReplenish = computed(() => (localNewTask.value.type_id || '') === 'Replenish');
const showPriorityLabel = computed(() => $q.screen.gt.sm);
const showFullTypeLabel = computed(() => $q.screen.gt.md);

// Type options for task type selector (local only)
const typeOptions = [
  { label: 'Time Event', shortLabel: 'Time', value: 'TimeEvent', icon: 'event' },
  { label: 'TODO', shortLabel: 'Todo', value: 'Todo', icon: 'check_box' },
  { label: 'Replenish', shortLabel: 'Repl', value: 'Replenish', icon: 'autorenew' },
  { label: 'Note/Later', shortLabel: 'Note', value: 'NoteLater', icon: 'description' },
];

// Options for the time type toggle (Whole Day / Exact Hour)
const timeTypeOptions = [
  { label: 'day', value: 'wholeDay', icon: 'calendar_today' },
  { label: 'hour', value: 'exactHour', icon: 'schedule' },
];

// Local replenish color sets grouped by family (4 tones each), ordered dark->bright
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

// Split into two rows for display
const replenishColorRows = computed(() => {
  const n = replenishColorSets.length;
  const per = Math.ceil(n / 3);
  return [
    replenishColorSets.slice(0, per),
    replenishColorSets.slice(per, per * 2),
    replenishColorSets.slice(per * 2),
  ];
});

// Replenish helper state
const replenishQuery = ref('');
const selectedReplenishId = ref<string | null>(null);
const showReplenishList = ref(false);
const replenishListStyle = ref<any>({ display: 'none' });

const replenishMatches = computed<any[]>(() => {
  const q = (replenishQuery.value || '').toLowerCase().trim();
  if (!q) return (props.allTasks || []).filter((t: any) => t.type_id === 'Replenish');
  return (props.allTasks || [])
    .filter((t: any) => t.type_id === 'Replenish')
    .filter((t: any) => (t.name || '').toLowerCase().indexOf(q) !== -1);
});

function selectReplenishMatch(t: any) {
  // Immediately restore selected replenish task to undone
  selectedReplenishId.value = t.id;
  replenishQuery.value = t.name || '';
  emit('replenish-restore', t.id);
  // clear selection/input after restore
  selectedReplenishId.value = null;
  replenishQuery.value = '';
  showReplenishList.value = false;
}

function createReplenishFromInput() {
  const name = (replenishQuery.value || '').trim();
  if (!name) return;
  // ensure task is Replenish type and undone (status_id = 1)
  localNewTask.value.name = name;
  localNewTask.value.type_id = 'Replenish';
  localNewTask.value.status_id = 1;
  emit('add-task', { ...localNewTask.value });
  // reset fields after creating
  replenishQuery.value = '';
  selectedReplenishId.value = null;
  localNewTask.value.description = '';
  showReplenishList.value = false;
}

// Auto-capitalize first letter typed into the replenish search box
watch(replenishQuery, (val) => {
  if (typeof val !== 'string') return;
  if (!val) return;
  const corrected = val.charAt(0).toUpperCase() + val.slice(1);
  if (corrected !== val) replenishQuery.value = corrected;
});

function onReplenishInput(val: string | number | null) {
  // coerce to string safely (Quasar may emit number|null)
  const s = val == null ? '' : String(val);
  // show list only when there's non-empty input
  showReplenishList.value = !!(s && s.trim());
  if (showReplenishList.value) {
    nextTick(positionReplenishList);
  } else {
    replenishListStyle.value = { display: 'none' };
  }
}

function onReplenishFocus() {
  // only show list on focus when there's content in the input
  if (replenishQuery.value && replenishQuery.value.trim()) {
    showReplenishList.value = true;
    nextTick(positionReplenishList);
  } else {
    showReplenishList.value = false;
  }
}

function positionReplenishList() {
  try {
    const inputEl = replenishInput.value?.$el || replenishInput.value;
    const input = inputEl?.querySelector ? inputEl.querySelector('input') : inputEl;
    if (!input) {
      replenishListStyle.value = { display: 'none' };
      return;
    }
    const rect = input.getBoundingClientRect();
    const left = rect.left + (window.scrollX || window.pageXOffset || 0);
    const top = rect.bottom + (window.scrollY || window.pageYOffset || 0) + 6;
    const width = rect.width || input.offsetWidth || 280;
    replenishListStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
      padding: '8px',
      zIndex: 4000,
      maxHeight: '260px',
      overflow: 'auto',
      display: 'block',
    };
  } catch (e) {
    replenishListStyle.value = { display: 'none' };
  }
}

onMounted(() => {
  window.addEventListener('resize', positionReplenishList);
  window.addEventListener('scroll', positionReplenishList, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', positionReplenishList);
  window.removeEventListener('scroll', positionReplenishList, true);
});

// When user switches type to Replenish while in add mode, focus the search input
watch(
  () => localNewTask.value.type_id,
  (val) => {
    if (val === 'Replenish' && props.mode === 'add') {
      nextTick(() => {
        try {
          // prefer Quasar focus API
          if (replenishInput.value && typeof replenishInput.value.focus === 'function') {
            replenishInput.value.focus();
            return;
          }
          const el = replenishInput.value?.$el || replenishInput.value;
          const input = el?.querySelector ? el.querySelector('input') : null;
          if (input && typeof input.focus === 'function') {
            input.focus();
          }
        } catch (e) {
          // ignore
        }
      });
    }
  },
);

// When parent provides an initialTask, populate localNewTask
watch(
  () => props.initialTask,
  (val) => {
    if (val) {
      // copy relevant fields
      localNewTask.value = {
        name: val.name || '',
        description: val.description || '',
        type_id: val.type_id || 'TimeEvent',
        status_id: val.status_id ?? 1,
        parent_id: val.parent_id ?? null,
        created_by: val.created_by || '',
        priority: val.priority || 'medium',
        groupId: val.groupId,
        eventDate: val.date || val.eventDate || localNewTask.value.eventDate,
        eventTime: val.eventTime || '',
        id: val.id,
      } as TaskType;
      emit('update:mode', 'edit');
    } else {
      // switch back to add mode and reset fields
      emit('update:mode', 'add');
      // keep date if provided via selectedDate prop
      localNewTask.value = {
        name: '',
        description: '',
        type_id: 'TimeEvent',
        status_id: 1,
        parent_id: null,
        created_by: '',
        priority: 'medium',
        groupId: props.activeGroup?.value ?? undefined,
        eventDate:
          props.selectedDate ||
          `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
        eventTime: '',
      } as TaskType;
    }
  },
  { immediate: true },
);

// Auto-generate name from description (local)
const autoGeneratedName = computed(() => {
  if (!localNewTask.value.description) return '';
  // Take up to a marker ' -' if present (e.g. "Title - details")
  const desc = localNewTask.value.description.trim();
  // Stop title at a newline or at the explicit marker ' -' (whichever comes first)
  const newlineIndex = desc.indexOf('\n');
  let markerIndex = desc.indexOf(' -');
  if (newlineIndex >= 0 && (markerIndex === -1 || newlineIndex < markerIndex)) {
    markerIndex = newlineIndex;
  }
  let head = '';
  if (markerIndex > 0) {
    head = desc.substring(0, markerIndex).trim();
  } else {
    // Take first sentence or first 50 characters
    const firstSentence = desc.split(/[.!?]/)[0] || '';
    head = firstSentence || desc.substring(0, 50);
  }

  const name = head.length > 50 ? head.substring(0, 50) + '...' : head;
  // Capitalize first letter
  const val = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
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
  { immediate: true },
);

// Keep local name in sync when auto-title is enabled
watch([autoGeneratedName, autoTitleEnabled], ([gen, enabled]) => {
  if (enabled) {
    localNewTask.value.name = gen;
  }
});

// Computed for eventTime hour and minute
const eventTimeHour = computed(() => {
  if (!localNewTask.value.eventTime) return '';
  const val = Number(localNewTask.value.eventTime.split(':')[0]);
  console.log('[computed] eventTimeHour', val);
  return val;
});
const eventTimeMinute = computed(() => {
  if (!localNewTask.value.eventTime) return '';
  const val = Number(localNewTask.value.eventTime.split(':')[1]);
  console.log('[computed] eventTimeMinute', val);
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
  hour: '',
  minute: '',
});
watch(timeType, (newValue, oldValue) => {
  if (newValue === 'wholeDay') {
    cachedTime.value.hour = eventTimeHour.value;
    cachedTime.value.minute = eventTimeMinute.value;
    localNewTask.value.eventTime = '';
  } else if (oldValue === 'wholeDay' && newValue === 'exactHour') {
    const hour = cachedTime.value.hour || 0;
    const minute = cachedTime.value.minute || 0;
    localNewTask.value.eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0',
    )}`;
  }
});

function updateTaskField(field: string, value: any) {
  if (field === 'eventDateDay') eventDateDay.value = value;
  else if (field === 'eventDateMonth') eventDateMonth.value = value;
  else if (field === 'eventDateYear') eventDateYear.value = value;
  else {
    (localNewTask.value as any)[field] = value;
  }
}

function onCalendarDateSelect(date: string) {
  localNewTask.value.eventDate = date;
  emit('calendar-date-select', date);
}

// Sync when parent calendar selection changes
watch(
  () => props.selectedDate,
  (val) => {
    if (val && val !== localNewTask.value.eventDate) {
      localNewTask.value.eventDate = val;
    }
  },
);
// ...existing code continues...

// Helper: format date as yyyy-MM-dd
function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Update handlers with auto-advance and auto-increment logic
const isUpdatingDate = ref(false);
function updateEventDateDay(val: number | string | null) {
  if (val === null || val === '' || isUpdatingDate.value) return;
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
        monthInput.value?.$el?.querySelector('input')?.focus();
      }, 0);
    }
  } finally {
    isUpdatingDate.value = false;
  }
}

function updateEventDateMonth(val: number | string | null) {
  if (val === null || val === '' || isUpdatingDate.value) return;
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
    const newDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    localNewTask.value.eventDate = newDate;
    // Auto-focus to hour input after filling month (when month is 2 digits)
    if (String(val).length >= 2) {
      setTimeout(() => {
        hourInput.value?.$el?.querySelector('input')?.focus();
      }, 0);
    }
  } finally {
    isUpdatingDate.value = false;
  }
}

function updateEventDateYear(val: number | string | null) {
  if (val === null || val === '') return;
  eventDateYear.value = Number(val);
}

function updateEventTimeHour(val: number | string | null) {
  if (val === null || val === '') return;
  const hour = Number(val);
  if (isNaN(hour) || hour < 0 || hour > 23) return;
  timeType.value = 'exactHour';
  const minute = eventTimeMinute.value || 0;
  // Update eventTime string in newTask
  const eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  localNewTask.value.eventTime = eventTime;
  // Auto-focus to minute input after filling hour (when hour is 2 digits)
  if (String(val).length >= 2) {
    setTimeout(() => {
      minuteInput.value?.$el?.querySelector('input')?.focus();
    }, 0);
  }
}

function updateEventTimeMinute(val: number | string | null) {
  if (val === null || val === '') return;
  const minute = Number(val);
  if (isNaN(minute) || minute < 0 || minute > 59) return;
  timeType.value = 'exactHour';
  const hour = eventTimeHour.value || 0;
  // Update eventTime string in newTask
  const eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  localNewTask.value.eventTime = eventTime;
}

// Returns a human-readable difference between the given date and today
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
// Computed for eventDate parts, always in sync with eventDate
const eventDate = computed(() => {
  const val = localNewTask.value.eventDate || '';
  console.log('[computed] eventDate', val);
  return val;
});
const eventDateParts = computed(() => {
  const val = eventDate.value.split('-');
  console.log('[computed] eventDateParts', val);
  return val;
});
const eventDateYear = computed({
  get: () => {
    const val = eventDateParts.value[0]
      ? Number(eventDateParts.value[0])
      : new Date().getFullYear();
    console.log('[computed] eventDateYear', val);
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
    console.log('[computed] eventDateMonth', val);
    return val;
  },
  set: (val: number) => {
    if (eventDateParts.value.length === 3) {
      localNewTask.value.eventDate = `${eventDateParts.value[0]}-${String(val).padStart(
        2,
        '0',
      )}-${eventDateParts.value[2]}`;
    }
  },
});
const eventDateDay = computed({
  get: () => {
    const val = eventDateParts.value[2] ? Number(eventDateParts.value[2]) : new Date().getDate();
    console.log('[computed] eventDateDay', val);
    return val;
  },
  set: (val: number) => {
    if (eventDateParts.value.length === 3) {
      localNewTask.value.eventDate = `${eventDateParts.value[0]}-${
        eventDateParts.value[1]
      }-${String(val).padStart(2, '0')}`;
    }
  },
});
const priorityOptions = [
  {
    label: 'Crit',
    value: 'critical',
    icon: 'warning',
    background: themePriorityColors.critical,
    textColor: themePriorityTextColor('critical'),
  },
  {
    label: 'Hi',
    value: 'high',
    icon: 'priority_high',
    background: themePriorityColors.high,
    textColor: themePriorityTextColor('high'),
  },
  {
    label: 'Med',
    value: 'medium',
    icon: 'drag_handle',
    background: themePriorityColors.medium,
    textColor: themePriorityTextColor('medium'),
  },
  {
    label: 'Lo',
    value: 'low',
    icon: 'low_priority',
    background: themePriorityColors.low,
    textColor: themePriorityTextColor('low'),
  },
];

// Colors for task types (used to color type buttons when active)
const typeColors: Record<string, string> = {
  TimeEvent: '#2196f3', // blue
  Todo: '#4caf50', // green
  NoteLater: '#9e9e9e', // grey
  Replenish: '#ffb300', // amber
};

const typeTextColors: Record<string, string> = {
  TimeEvent: 'white',
  Todo: 'white',
  NoteLater: 'white',
  Replenish: 'white',
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
  const len = (localNewTask.value.description || '').length;
  return len > 100 ? 8 : 4;
});

// Auto-resize textarea to fit content
const descriptionInput = ref<any>(null);
function adjustDescriptionHeight() {
  nextTick(() => {
    try {
      const root = descriptionInput.value?.$el || descriptionInput.value;
      const ta: HTMLTextAreaElement | null = root?.querySelector
        ? root.querySelector('textarea')
        : null;
      if (ta) {
        ta.style.height = 'auto';
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
  },
);

onMounted(() => {
  adjustDescriptionHeight();
});

function onSubmit(event: Event) {
  event.preventDefault();
  // If this is a Replenish task and the user typed a query, use it as the name
  if (
    localNewTask.value.type_id === 'Replenish' &&
    replenishQuery.value &&
    replenishQuery.value.trim()
  ) {
    localNewTask.value.name = replenishQuery.value.trim();
    localNewTask.value.status_id = 1; // ensure undone
    // clear the query so subsequent submits don't reuse it
    replenishQuery.value = '';
  }
  // Ensure a name exists: prefer explicit name, otherwise use auto-generated name
  if (!localNewTask.value.name || !localNewTask.value.name.trim()) {
    const generated = autoGeneratedName.value || '';
    if (generated) localNewTask.value.name = generated;
  }
  if (props.mode === 'add') {
    console.log('[emit] add-task', { ...localNewTask.value });
    emit('add-task', { ...localNewTask.value });
    // Clear the description textarea after adding the task
    localNewTask.value.description = '';
    // Reset status checkbox to '1' (just created)
    try {
      (statusValue as any).value = 1;
    } catch (e) {
      localNewTask.value.status_id = 1;
    }
  } else {
    // Edit mode: emit update and switch back to add mode
    console.log('[emit] update-task', { ...localNewTask.value });
    emit('update-task', { ...localNewTask.value });
    // reset form to add defaults
    emit('update:mode', 'add');
    // notify parent to clear its edit selection
    emit('cancel-edit');
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
                      <div class="text-caption text-grey-7 q-mb-xs">Date</div>
                      <div class="row q-gutter-xs items-center" style="align-items: center">
                        <div class="row q-gutter-xs" style="gap: 8px; align-items: center">
                          <q-input
                            ref="dayInput"
                            :model-value="eventDateDay"
                            @update:model-value="updateEventDateDay"
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
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
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                            type="number"
                            label="Month"
                            outlined
                            dense
                            min="1"
                            max="12"
                            style="max-width: 80px"
                          />
                          <q-input
                            ref="yearInput"
                            :model-value="eventDateYear"
                            @update:model-value="updateEventDateYear"
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
                            type="number"
                            label="Year"
                            outlined
                            dense
                            style="max-width: 100px"
                          />
                        </div>
                        <div class="col"></div>
                        <div class="col-auto" style="display: flex; align-items: center">
                          <q-checkbox v-model="autoIncrementYear" dense size="xs" label="Auto" />
                        </div>
                      </div>
                      <div class="row items-center q-gutter-xs q-mb-sm">
                        <div class="row q-gutter-xs" style="gap: 8px">
                          <!-- day/month inputs -->
                        </div>
                      </div>
                      <div class="row q-gutter-xs">
                        <div class="column" style="max-width: 80px">
                          <q-input
                            ref="hourInput"
                            :model-value="eventTimeHour"
                            @update:model-value="updateEventTimeHour"
                            type="number"
                            @focus="
                              (e) =>
                                (e.target as HTMLInputElement)?.select &&
                                (e.target as HTMLInputElement).select()
                            "
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
                          @focus="
                            (e) =>
                              (e.target as HTMLInputElement)?.select &&
                              (e.target as HTMLInputElement).select()
                          "
                          label="Minute"
                          outlined
                          dense
                          min="0"
                          max="59"
                          style="max-width: 80px"
                        />

                        <div class="row q-mt-sm" style="gap: 8px; align-items: center">
                          <div class="col-auto">
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
                      </div>
                      <div class="text-caption text-grey-7 q-mt-sm q-mb-xs">Time Difference</div>
                      <div class="text-h6 text-primary text-weight-bold q-mb-sm">
                        {{ getTimeDifferenceDisplay(localNewTask.eventDate) }}
                      </div>
                    </q-card>
                  </div>
                  <br />
                  <div>
                    <q-input
                      v-if="!isReplenish"
                      ref="descriptionInput"
                      :model-value="localNewTask.description"
                      label="Description"
                      outlined
                      type="textarea"
                      rows="1"
                      class="col"
                      @update:model-value="(val) => updateTaskField('description', val)"
                    />
                    <!-- Auto title input placed under Type card -->
                    <div
                      v-if="!(isReplenish && props.mode === 'add')"
                      class="row items-center q-mt-sm"
                      style="gap: 8px"
                    >
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

                    <!-- Replenish special field: search existing or create new (moved above submit buttons) -->
                    <div
                      v-if="isReplenish && mode === 'add'"
                      class="q-pa-sm col"
                      style="position: relative"
                    >
                      <div class="text-caption text-grey-7 q-mb-xs">Replenish</div>
                      <q-input
                        ref="replenishInput"
                        v-model="replenishQuery"
                        @update:model-value="onReplenishInput"
                        @focus="onReplenishFocus"
                        label="Search existing Replenish or type a new title"
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
                            clickable
                            @click="selectReplenishMatch(m)"
                            class="q-pa-sm bg-white"
                            style="border-radius: 6px; margin-bottom: 6px"
                          >
                            <q-item-section>
                              <div class="text-body1">{{ m.name }}</div>
                            </q-item-section>
                          </q-item>
                        </q-list>
                      </div>
                    </div>

                    <!-- Color chooser for Replenish tasks (moved above submit buttons) -->
                    <div
                      v-if="isReplenish && (props.mode === 'add' || props.mode === 'edit')"
                      class="q-pa-sm col"
                    >
                      <div class="text-caption text-grey-7 q-mb-xs">Replenish color</div>
                      <div class="row" style="gap: 8px; align-items: center">
                        <div style="flex: 0 1 auto">
                          <div
                            v-for="(row, ridx) in replenishColorRows"
                            :key="ridx"
                            class="row"
                            style="gap: 8px; align-items: center; margin-bottom: 6px"
                          >
                            <div v-for="cs in row" :key="cs.id" class="row items-center" style="gap: 6px">
                              <div
                                class="color-swatch"
                                :style="{
                                  background: cs.bg,
                                  border:
                                    cs.id === (localNewTask as any).color_set
                                      ? '2px solid #000'
                                      : '1px solid rgba(0,0,0,0.08)',
                                }"
                                @click.stop="(localNewTask as any).color_set = cs.id"
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div style="flex: 0 0 auto">
                          <q-btn
                            flat
                            dense
                            round
                            icon="clear"
                            @click.stop="
                              () => {
                                (localNewTask as any).color_set = null;
                              }
                            "
                            title="Use default"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <br />
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
                          <strong>{{ activeGroup.label.split(' (')[0] }}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Priority and Type column to the right of date/time -->
                <div class="col-12 col-md-4">
                  <q-card flat bordered class="q-pa-sm">
                    <div class="text-caption text-grey-7 q-mb-xs">Priority</div>
                    <div class="priority-grid">
                      <div
                        v-for="option in priorityOptions"
                        :key="option.value"
                        class="priority-item"
                      >
                        <q-btn
                          :color="
                            localNewTask.priority === option.value ? option.background : 'grey-3'
                          "
                          :text-color="
                            localNewTask.priority === option.value ? option.textColor : 'grey-7'
                          "
                          :icon="option.icon"
                          :label="showPriorityLabel ? option.label : ''"
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
                              localNewTask.priority === option.value ? option.textColor : undefined,
                          }"
                        />
                      </div>
                    </div>
                  </q-card>

                  <q-card flat bordered class="q-pa-sm q-mt-sm">
                    <div class="text-caption text-grey-7 q-mb-xs">Type</div>
                    <div class="column q-gutter-xs">
                      <q-btn
                        v-for="opt in typeOptions"
                        :key="opt.value"
                        :label="showFullTypeLabel ? opt.label : opt.shortLabel || opt.label"
                        :aria-label="opt.label"
                        :icon="opt.icon"
                        :size="btnSize"
                        class="full-width priority-btn"
                        :outline="localNewTask.type_id !== opt.value"
                        :unelevated="localNewTask.type_id === opt.value"
                        @click="localNewTask.type_id = opt.value"
                        :style="{
                          backgroundColor:
                            localNewTask.type_id === opt.value ? typeColors[opt.value] : undefined,
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
  padding-left: 6px !important;
  padding-right: 6px !important;
}
.priority-btn .q-btn__content {
  justify-content: center !important;
}
.priority-btn .q-icon {
  margin-right: 6px !important;
}

/* Grid for priority buttons: 1 column on small, 2 columns on md+ */
.priority-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  justify-items: stretch;
  width: 100%;
}
@media (min-width: 960px) {
  .priority-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.priority-item {
  display: block;
}
.priority-item .q-btn {
  width: 100%;
}

/* Stack icon above label for priority buttons on md+ and center them */
@media (min-width: 960px) {
  ::v-deep .priority-btn .q-btn__content {
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
  }
  ::v-deep .priority-btn .q-btn__content .q-icon {
    margin-right: 0 !important;
    margin-bottom: 6px !important;
  }
  ::v-deep .priority-btn .q-btn__label {
    white-space: normal !important;
    text-align: center !important;
  }
}

/* Small adjustments for the time type toggle inside date/time card */
.time-toggle {
  --q-btn-padding: 6px 8px;
}
.time-toggle .q-btn__content {
  gap: 4px;
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
  font-size: 12px !important;
  width: 12px !important;
  height: 12px !important;
  margin-right: 4px !important;
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
::v-deep .time-toggle .q-btn__content,
::v-deep .time-toggle .q-btn__content .q-btn__label {
  font-size: 12px !important;
  line-height: 1 !important;
  padding: 0 !important;
  text-transform: capitalize !important;
}
::v-deep .time-toggle .q-btn__content .q-icon,
::v-deep .time-toggle .q-icon {
  font-size: 12px !important;
  width: 12px !important;
  height: 12px !important;
}
</style>
