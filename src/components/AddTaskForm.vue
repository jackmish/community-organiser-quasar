<script setup lang="ts">
import { computed, ref, nextTick, watch, toRef, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar, Dialog } from 'quasar';
import CalendarView from './CalendarView.vue';
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  priorityDefinitions as themePriorityDefinitions,
  replenishColorSets as themeReplenishColorSets,
  getReplenishBg as themeGetReplenishBg,
  getReplenishText as themeGetReplenishText,
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
  'delete-task',
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

// Repeat mode for events: one-time or cyclic
const repeatMode = ref<'oneTime' | 'cyclic'>('oneTime');
const repeatOptions = [
  { label: 'One time', value: 'oneTime', icon: 'event' },
  { label: 'Cyclic', value: 'cyclic', icon: 'repeat' },
];

// When cyclic, choose period
const repeatCycleType = ref<'dayWeek' | 'month' | 'year' | 'other'>('dayWeek');
const repeatCycleOptions = [
  { label: 'Day/Week', value: 'dayWeek', icon: 'today' },
  { label: 'Month', value: 'month', icon: 'date_range' },
  { label: 'Year', value: 'year', icon: 'event' },
  { label: 'Other', value: 'other', icon: 'more_horiz' },
];

// Weekday multi-select for day/week repeat
const weekDayOptions = [
  { label: 'Mon', value: 'mon' },
  { label: 'Tue', value: 'tue' },
  { label: 'Wed', value: 'wed' },
  { label: 'Thu', value: 'thu' },
  { label: 'Fri', value: 'fri' },
  { label: 'Sat', value: 'sat' },
  { label: 'Sun', value: 'sun' },
];
const repeatDays = ref<string[]>([]);

function checkAllDays() {
  repeatDays.value = weekDayOptions.map((o) => o.value);
}
function clearDays() {
  repeatDays.value = [];
}

function toggleDay(day: string) {
  const idx = repeatDays.value.indexOf(day);
  if (idx === -1) repeatDays.value = [...repeatDays.value, day];
  else repeatDays.value = repeatDays.value.filter((d) => d !== day);
}

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

// Convert hex like '#aabbcc' to rgba string with given alpha
function hexToRgba(hex: string, alpha = 1) {
  const h = hex.replace('#', '');
  const bigint = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Accent color based on task type (used for a subtle 4px ring)
const formAccentColor = computed(() => {
  const type = (localNewTask as any)?.value?.type_id ?? (localNewTask as any)?.type_id ?? null;
  switch (type) {
    case 'Todo':
      return '#a5d6a7'; // light green
    case 'TimeEvent':
      return '#90caf9'; // light blue
    case 'Replenish':
      return '#ffeb3b'; // light yellow
    case 'NoteLater':
      return '#e0e0e0'; // light grey
    default:
      return props.mode === 'add' ? '#e8f5e9' : props.mode === 'edit' ? '#fff3e0' : '#ffffff';
  }
});

// Card background style depending on mode and accented ring by task type
const cardStyle = computed(() => {
  const bg = props.mode === 'add' ? '#e8f5e9' : props.mode === 'edit' ? '#fff3e0' : '#ffffff';
  const accent = formAccentColor.value || '#000000';
  return {
    backgroundColor: bg,
    borderLeft: `8px solid ${accent}`,
    borderRight: '0',
    borderTop: '0',
    borderBottom: '0',
  };
});

// Watermark icon depending on mode/type
const watermarkIcon = computed(() => {
  try {
    const type = (localNewTask as any)?.value?.type_id ?? (localNewTask as any)?.type_id ?? null;
    if (props.mode === 'add') {
      switch (type) {
        case 'Todo':
          return 'check_box';
        case 'TimeEvent':
          return 'event';
        case 'Replenish':
          return 'autorenew';
        case 'NoteLater':
          return 'description';
        default:
          return 'add_circle';
      }
    }
    if (props.mode === 'edit') {
      switch (type) {
        case 'Todo':
          return 'check_box';
        case 'TimeEvent':
          return 'event';
        case 'Replenish':
          return 'autorenew';
        case 'NoteLater':
          return 'description';
        default:
          return 'edit';
      }
    }
    if (props.mode === 'preview') {
      switch (type) {
        case 'Todo':
          return 'check_box';
        case 'TimeEvent':
          return 'event';
        case 'Replenish':
          return 'autorenew';
        case 'NoteLater':
          return 'description';
        default:
          return 'visibility';
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
const btnSize = computed(() => ($q.screen.gt.sm ? 'md' : 'sm'));
const isReplenish = computed(() => (localNewTask.value.type_id || '') === 'Replenish');
const showPriorityLabel = computed(() => $q.screen.gt.sm);
const showFullTypeLabel = computed(() => $q.screen.gt.md);

// Submit button appearance based on mode
const submitColor = computed(() => {
  if (props.mode === 'add') return '#4caf50';
  if (props.mode === 'edit') return '#ff9800';
  return 'primary';
});

const submitIcon = computed(() => {
  if (props.mode === 'add') return 'add';
  if (props.mode === 'edit') return 'edit';
  return '';
});

// Type options for task type selector (local only)
const typeOptions = [
  { label: 'Time Event', shortLabel: 'Time', value: 'TimeEvent', icon: 'event' },
  { label: 'TODO', shortLabel: 'Todo', value: 'Todo', icon: 'check_box' },
  { label: 'Replenish', shortLabel: 'Repl', value: 'Replenish', icon: 'autorenew' },
  { label: 'Note/Later', shortLabel: 'Note', value: 'NoteLater', icon: 'description' },
];

// Options for the time type toggle (Whole Day / Exact Hour)
const timeTypeOptions = [
  { label: '', value: 'wholeDay', icon: 'calendar_today' },
  { label: '', value: 'exactHour', icon: 'schedule' },
];

// Use centralized replenish color sets from theme
const replenishColorSets = themeReplenishColorSets;

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
      // Populate repeat-related form fields from canonical `repeat` object if present
      try {
        if (val.repeat && typeof val.repeat === 'object') {
          repeatMode.value = 'cyclic';
          repeatCycleType.value = val.repeat.cycleType || 'dayWeek';
          repeatDays.value = Array.isArray(val.repeat.days) ? [...val.repeat.days] : [];
          // Prefer eventDate from repeat seed if not set on task
          if (!localNewTask.value.eventDate && val.repeat.eventDate) {
            localNewTask.value.eventDate = val.repeat.eventDate;
          }
        } else {
          repeatMode.value = 'oneTime';
          repeatCycleType.value = 'dayWeek';
          repeatDays.value = [];
        }
      } catch (e) {
        repeatMode.value = 'oneTime';
        repeatCycleType.value = 'dayWeek';
        repeatDays.value = [];
      }

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
      // Reset repeat inputs when clearing the form
      repeatMode.value = 'oneTime';
      repeatCycleType.value = 'dayWeek';
      repeatDays.value = [];
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

// Always keep local name in sync with the auto-generated title from description
watch(autoGeneratedName, (gen) => {
  localNewTask.value.name = gen;
});

// Computed for eventTime hour and minute with setters so inputs can `v-model` directly
const eventTimeHour = computed<number | string>({
  get() {
    if (!localNewTask.value.eventTime) return '';
    const val = Number(localNewTask.value.eventTime.split(':')[0]);
    return val;
  },
  set(v: number | string) {
    if (v === null || v === '') {
      // ignore transient empty updates (don't clear stored eventTime)
      return;
    }
    const hour = Number(v);
    if (isNaN(hour) || hour < 0 || hour > 23) return;
    timeType.value = 'exactHour';
    const minute = Number(eventTimeMinute.value) || 0;
    localNewTask.value.eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  },
});
const eventTimeMinute = computed<number | string>({
  get() {
    if (!localNewTask.value.eventTime) return '';
    const val = Number(localNewTask.value.eventTime.split(':')[1]);
    return val;
  },
  set(v: number | string) {
    if (v === null || v === '') {
      // ignore transient empty updates (don't clear stored eventTime)
      return;
    }
    const minute = Number(v);
    if (isNaN(minute) || minute < 0 || minute > 59) return;
    timeType.value = 'exactHour';
    const hour = Number(eventTimeHour.value) || 0;
    localNewTask.value.eventTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  },
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

// Watch timeType to clear/restore time when toggling modes.
// Cache stores null when there's no value; restore only if the current task
// has no time (or is explicitly zero) so user-entered values are not overwritten.
const cachedTime = ref<{ hour: string | number | null; minute: string | number | null }>({
  hour: null,
  minute: null,
});
watch(timeType, (newValue, oldValue) => {
  if (newValue === 'wholeDay') {
    // Cache existing hour/minute if present
    cachedTime.value.hour = eventTimeHour.value === '' ? null : eventTimeHour.value;
    cachedTime.value.minute = eventTimeMinute.value === '' ? null : eventTimeMinute.value;
    // Clear displayed time for whole-day view
    localNewTask.value.eventTime = '';
  } else if (oldValue === 'wholeDay' && newValue === 'exactHour') {
    // Only restore cached time if there is no user-provided time while in wholeDay
    const current = localNewTask.value.eventTime;
    const currentIsEmpty = !current || current === '' || current === '00:00';
    if (!currentIsEmpty) {
      // user set a time while in wholeDay — do not overwrite
      return;
    }
    const hour = cachedTime.value.hour != null ? cachedTime.value.hour : null;
    const minute = cachedTime.value.minute != null ? cachedTime.value.minute : null;
    if (hour == null && minute == null) {
      // nothing to restore
      return;
    }
    const h = hour == null ? 0 : Number(hour);
    const m = minute == null ? 0 : Number(minute);
    localNewTask.value.eventTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
  emit('delete-task', { id: localNewTask.value.id, date: localNewTask.value.eventDate });
  emit('cancel-edit');
  showDeleteConfirm.value = false;
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

// (Handlers replaced by computed setters above)

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
  return val;
});
const eventDateParts = computed(() => {
  const val = eventDate.value.split('-');
  return val;
});
const eventDateYear = computed({
  get: () => {
    const val = eventDateParts.value[0]
      ? Number(eventDateParts.value[0])
      : new Date().getFullYear();
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
  Replenish: '#ffeb3b', // yellow
};

const typeTextColors: Record<string, string> = {
  TimeEvent: 'white',
  Todo: 'white',
  NoteLater: 'white',
  Replenish: '#212121',
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
    const payload: any = { ...localNewTask.value };
    // Canonical repeat object
    if (repeatMode.value === 'cyclic') {
      payload.repeat = {
        cycleType: repeatCycleType.value,
        days: Array.isArray(repeatDays.value) ? [...repeatDays.value] : [],
        eventDate: localNewTask.value.eventDate || null,
      };
    } else {
      payload.repeat = null;
    }
    emit('add-task', payload);
    // Clear the description textarea after adding the task
    localNewTask.value.description = '';
    // Reset status checkbox to '1' (just created)
    try {
      (statusValue as any).value = 1;
    } catch (e) {
      localNewTask.value.status_id = 1;
    }
  } else {
    // Edit mode: convert repeat form fields into canonical object before update
    const updated = { ...localNewTask.value } as any;
    if (repeatMode.value === 'cyclic') {
      updated.repeat = {
        cycleType: repeatCycleType.value,
        days: Array.isArray(repeatDays.value) ? [...repeatDays.value] : [],
        eventDate: localNewTask.value.eventDate || null,
      };
    } else {
      updated.repeat = null;
    }
    // Emit update and switch back to add mode
    emit('update-task', updated);
    // reset form to add defaults
    emit('update:mode', 'add');
    // notify parent to clear its edit selection
    emit('cancel-edit');
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
    <q-card-section>
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
          <span style="font-weight: 500">{{ localNewTask.name || 'Untitled' }}</span>
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
                      <div class="row items-center q-mb-xs" style="gap: 8px; align-items: center">
                        <div class="text-caption text-grey-7">Date</div>

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
                          class="text-h6 text-primary text-weight-bold q-mb-sm"
                        >
                          {{ getTimeDifferenceDisplay(localNewTask.eventDate) }}
                        </div>
                        <div class="col-auto" v-if="repeatMode !== 'cyclic'">
                          <q-checkbox v-model="autoIncrementYear" dense size="xs" label="Auto" />
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

                        <div v-if="repeatCycleType === 'dayWeek'" class="q-mt-sm">
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
                                'weekday-btn-selected': repeatDays.indexOf(opt.value) !== -1,
                              }"
                            />
                          </div>
                          <div class="row" style="gap: 8px; margin-top: 6px; align-items: center">
                            <q-btn dense flat size="sm" label="Check all" @click="checkAllDays" />
                            <q-btn dense flat size="sm" label="Clear" @click="clearDays" />
                          </div>
                        </div>
                      </div>

                      <div
                        v-if="!(repeatMode === 'cyclic' && repeatCycleType === 'dayWeek')"
                        class="row q-gutter-xs items-center"
                        style="align-items: center"
                      >
                        <div
                          class="row q-gutter-xs date-inputs-row"
                          style="gap: 8px; align-items: center; flex-wrap: nowrap; overflow-x: auto"
                        >
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
                            style="max-width: 80px"
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
                        style="gap: 8px; align-items: center; flex-wrap: nowrap; overflow-x: auto"
                      >
                        <div style="flex: 0 0 auto; display: flex; gap: 8px; align-items: center">
                          <q-input
                            ref="hourInput"
                            v-model="eventTimeHour"
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
                            label="Minute"
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
                    <!-- Title is auto-generated from description; input removed -->

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
                            <div
                              v-for="cs in row"
                              :key="cs.id"
                              class="row items-center"
                              style="gap: 6px"
                            >
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
                          unelevated
                          :icon="submitIcon || undefined"
                          :label="
                            mode === 'add' ? 'Add Task' : mode === 'edit' ? 'Update' : 'Preview'
                          "
                          :disable="mode === 'preview'"
                          :style="{ backgroundColor: submitColor, color: '#ffffff' }"
                          class="text-white"
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
                        <div v-if="mode === 'edit'" class="q-ml-sm">
                          <q-btn
                            flat
                            color="negative"
                            icon="delete"
                            label="Remove"
                            @click.stop="openDeleteConfirm"
                          />
                          <div
                            v-if="showDeleteConfirm"
                            class="row items-center"
                            style="gap: 8px; display: inline-flex; margin-left: 8px"
                          >
                            <div>Delete?</div>
                            <q-btn
                              flat
                              dense
                              color="negative"
                              label="Yes"
                              @click.stop="performDelete"
                            />
                            <q-btn flat dense label="No" @click.stop="cancelDeleteConfirm" />
                          </div>
                        </div>
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
                  <q-card flat bordered class="q-pa-sm q-mt-sm">
                    <div class="text-caption text-grey-7 q-mb-xs">Task type</div>
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
.add-task-card {
  position: relative;
  overflow: visible;
}
.add-watermark-text {
  position: absolute;
  right: 8px;
  bottom: 8px;
  font-family: 'Material Icons';
  font-size: 260px;
  opacity: 0.14;
  color: rgba(0, 0, 0, 0.1);
  transform: rotate(-12deg);
  pointer-events: none;
  z-index: 1; /* sits above card background but below inputs */
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
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
  --q-btn-padding: 4px 6px;
}
.time-toggle .q-btn__content {
  gap: 2px;
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
::v-deep .weekday-row .q-btn {
  border-radius: 0 !important;
}
::v-deep .weekday-row .q-btn:first-child {
  border-top-left-radius: 6px !important;
  border-bottom-left-radius: 6px !important;
}
::v-deep .weekday-row .q-btn:last-child {
  border-top-right-radius: 6px !important;
  border-bottom-right-radius: 6px !important;
}

::v-deep .q-btn.weekday-btn-selected,
::v-deep button.q-btn.weekday-btn-selected,
::v-deep .q-btn.weekday-btn-selected.q-btn--unelevated {
  background-color: var(--q-color-primary, #1976d2) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
::v-deep .q-btn.weekday-btn-selected .q-btn__content,
::v-deep button.q-btn.weekday-btn-selected .q-btn__content {
  background-color: transparent !important;
  color: inherit !important;
}
::v-deep .q-btn.weekday-btn-selected .q-icon,
::v-deep button.q-btn.weekday-btn-selected .q-icon {
  color: inherit !important;
}

/* Ensure form inputs have a white background within this component */
::v-deep .q-field__control {
  background: #ffffff !important;
  border-radius: 6px !important;
}

/* Ensure textarea/input elements inherit white background for readability */
::v-deep textarea,
::v-deep input {
  background: transparent !important;
}

/* Make radio-like buttons (btn-toggles and priority/type buttons) use white background by default when NOT active.
   Do not use !important so active/selected rules can override this default. */
::v-deep .q-btn-toggle .q-btn:not(.q-btn--active),
::v-deep .time-toggle .q-btn:not(.q-btn--active),
::v-deep .priority-btn.q-btn:not(.q-btn--active) {
  background: #ffffff;
  color: inherit;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
</style>
