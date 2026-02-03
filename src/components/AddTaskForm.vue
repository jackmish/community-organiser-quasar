<script setup lang="ts">
import { computed, ref, nextTick, watch, toRef, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar, Dialog } from 'quasar';
import { useDayOrganiser } from '../modules/day-organiser';
import logger from 'src/utils/logger';
import CalendarView from './CalendarView.vue';
import ReplenishmentList from './ReplenishmentList.vue';
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  priorityDefinitions as themePriorityDefinitions,
  replenishColorSets as themeReplenishColorSets,
  getReplenishBg as themeGetReplenishBg,
  getReplenishText as themeGetReplenishText,
  formatEventHoursDiff,
  typeColors as themeTypeColors,
  typeTextColors as themeTypeTextColors,
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
  'delete-task',
  'toggle-status',
  'edit-task',
]);

// Group menu state for edit-mode group changing
const groupMenu = ref(false);
const { groups, updateTask } = useDayOrganiser();

async function selectGroupForEdit(gid: string | null) {
  try {
    // Use localNewTask eventDate (fallback to selectedDate prop)
    const date = localNewTask.value.eventDate || props.selectedDate || '';
    const taskId = localNewTask.value.id;
    if (!taskId) return;
    const updates: any = { groupId: gid == null ? undefined : gid };
    await updateTask(date, taskId, updates);
    // Also reflect immediately in the form state
    localNewTask.value.groupId = gid == null ? undefined : gid;
  } catch (e) {
    logger.error('Failed to change task group (edit mode)', e);
  } finally {
    groupMenu.value = false;
  }
}

async function selectGroupForAdd(gid: string | null) {
  try {
    localNewTask.value.groupId = gid == null ? undefined : gid;
  } catch (e) {
    logger.error('Failed to change task group (add mode)', e);
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
const repeatCycleType = ref<'dayWeek' | 'interval' | 'nth'>('dayWeek');
const repeatCycleOptions = [
  { label: 'Day/Week', value: 'dayWeek', icon: 'today' },
  { label: 'Interval', value: 'interval', icon: 'repeat' },
  { label: 'Nth', value: 'nth', icon: 'looks_one' },
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
// Option to quickly set an exact day-of-month (e.g. 10)
const everyNDayOfMonth = ref<number | null>(null);
// Interval in days for month/year cycle types (optional)
const repeatIntervalDays = ref<number | null>(null);

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
  // timeMode controls how the time is interpreted in the UI
  // 'event' = normal event (default), 'prepare' = preparation time, 'expiration' = expiration time
  timeMode?: 'event' | 'prepare' | 'expiration';
  // number of days before the event (used for prepare/expiration modes)
  timeOffsetDays?: number | null;
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
  timeMode: 'event',
  timeOffsetDays: 7,
});

// Remember the last selected task type so resetting the form doesn't revert the chooser.
// Persist to localStorage so the selection survives form resets/remounts.
const STORAGE_KEY = 'coq:lastTaskType';
let initialStored = 'TimeEvent';
try {
  const s = localStorage.getItem(STORAGE_KEY);
  if (s) initialStored = s;
} catch (e) {
  // ignore (e.g. SSR or blocked storage)
}
const lastSelectedType = ref<string>(initialStored || localNewTask.value.type_id || 'TimeEvent');
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
  },
);

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

// Mode-based accent color (creation/edit)
const modeAccentColor = computed(() => {
  if (props.mode === 'add') return '#4caf50'; // green for creation
  if (props.mode === 'edit') return '#ff9800'; // orange for edit
  return '#1976d2'; // default primary
});

// Card background style depending on mode; draw an 8px solid border on all sides using mode color
const cardStyle = computed(() => {
  // If the current task type is Replenish, use a light yellow background
  if (isReplenish.value) {
    const bg = '#f5efe6'; // latte-like light beige
    const accent = '#c9a676';
    return { backgroundColor: bg, border: `8px solid ${accent}` };
  }
  const bg = props.mode === 'add' ? '#e8f5e9' : props.mode === 'edit' ? '#fff3e0' : '#ffffff';
  const accent = modeAccentColor.value || '#000000';
  return { backgroundColor: bg, border: `8px solid ${accent}` };
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
  // When creating a Replenish item, prefer the selected replenish set
  try {
    if (props.mode === 'add' && isReplenish.value) {
      const cs = (localNewTask as any).color_set;
      const bg = (themeGetReplenishBg as any)(cs);
      return bg && bg !== 'transparent' ? bg : themeTypeColors.Replenish || '#f5efe6';
    }
  } catch (e) {
    // fall back
  }
  if (props.mode === 'add') return '#4caf50';
  if (props.mode === 'edit') return '#ff9800';
  return 'primary';
});

const submitTextColor = computed(() => {
  try {
    if (props.mode === 'add' && isReplenish.value) {
      const cs = (localNewTask as any).color_set;
      const txt = (themeGetReplenishText as any)(cs);
      return txt && txt !== 'inherit' ? txt : themeTypeTextColors.Replenish || '#212121';
    }
  } catch (e) {
    // ignore
  }
  return '#ffffff';
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

// Options for interpreting the time value: event (default), prepare, expiration
// Labels are shown inside each toggle button so the option describes its mode
const timeModeOptions = [
  { label: 'Event', value: 'event', icon: 'event' },
  { label: 'Prepare', value: 'prepare', icon: 'local_shipping' },
  { label: 'Expiration', value: 'expiration', icon: 'hourglass_empty' },
];

const eventTimeMode = computed<'event' | 'prepare' | 'expiration'>({
  get() {
    return localNewTask.value.timeMode || 'event';
  },
  set(v) {
    localNewTask.value.timeMode = v;
  },
});

const eventTimeOffsetDays = computed<number | null>({
  get() {
    const v = (localNewTask.value as any).timeOffsetDays;
    return v == null ? null : Number(v);
  },
  set(val: number | null) {
    (localNewTask.value as any).timeOffsetDays = val == null ? null : Number(val);
  },
});

function setOffsetDays(n: number) {
  (localNewTask.value as any).timeOffsetDays = Number(n);
}

// Use centralized replenish color sets from theme
const replenishColorSets = themeReplenishColorSets;

// Split into four rows for display and include a transparent 'x' swatch
const replenishColorRows = computed(() => {
  // include a transparent option at the start
  const transparent = { id: 'transparent', bg: 'transparent', text: '#000000' };
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

const smallReplenishTasks = computed(() => {
  // Prefer parent-provided filtered replenish list when available
  if (
    props.replenishTasks &&
    Array.isArray(props.replenishTasks) &&
    props.replenishTasks.length > 0
  )
    return props.replenishTasks;
  return (props.allTasks || []).filter((t: any) => (t.type_id || t.type) === 'Replenish');
});

// Return true when a replenish match is already present for the current selected date
function replenishAlreadyAdded(m: any) {
  try {
    const name = (m && m.name && String(m.name).trim().toLowerCase()) || '';
    if (!name) return false;
    const sel = String(props.selectedDate || '').trim();
    return (props.allTasks || []).some((t: any) => {
      if ((t.type_id || t.type) !== 'Replenish') return false;
      // exact id match
      if (t.id && m.id && String(t.id) === String(m.id)) return true;
      const tn = (t.name || '').trim().toLowerCase();
      if (tn !== name) return false;
      // if selected date provided, check task date matches selected date
      const taskDate = t.date || t.eventDate || '';
      if (sel) return String(taskDate || '') === sel;
      // otherwise treat same-name replenish task as present
      return true;
    });
  } catch (e) {
    return false;
  }
}

async function selectReplenishMatch(t: any) {
  try {
    console.log('[REPLENISH] selectReplenishMatch', { id: t.id, name: t.name });
  } catch (err) {
    void err;
  }
  // Immediately restore selected replenish task to undone
  selectedReplenishId.value = t.id;
  replenishQuery.value = t.name || '';
  try {
    const { updateTask } = useDayOrganiser();
    const targetDate = t.date || t.eventDate || props.selectedDate || localNewTask.value.eventDate;
    console.log('[REPLENISH] restoring task id=', t.id, ' to date=', targetDate);
    await updateTask(targetDate, t.id, { status_id: 1 });
    // Ask parent to clear any preview/edit state
    emit('cancel-edit');
  } catch (e) {
    logger.error('Failed to restore replenish task', e);
  }
  // clear selection/input after restore
  selectedReplenishId.value = null;
  replenishQuery.value = '';
  showReplenishList.value = false;
}

function handleReplItemPointer(t: any) {
  try {
    console.log('[REPLENISH] handleReplItemPointer', { id: t.id, name: t.name });
  } catch (err) {
    void err;
  }
  selectReplenishMatch(t);
}

function createReplenishFromInput() {
  const name = (replenishQuery.value || '').trim();
  if (!name) return;
  // ensure task is Replenish type and undone (status_id = 1)
  localNewTask.value.name = name;
  localNewTask.value.type_id = 'Replenish';
  localNewTask.value.status_id = 1;
  emit('add-task', { ...localNewTask.value }, { preview: !stayAfterSave.value });
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
    if (props.mode !== 'add') return;

    nextTick(() => {
      try {
        if (val === 'Replenish') {
          // prefer Quasar focus API
          if (replenishInput.value && typeof replenishInput.value.focus === 'function') {
            replenishInput.value.focus();
            return;
          }
          const el = replenishInput.value?.$el || replenishInput.value;
          const input = el?.querySelector ? el.querySelector('input') : null;
          if (input && typeof input.focus === 'function') {
            input.focus();
            return;
          }
        }

        if (val === 'Todo' || val === 'NoteLater') {
          // focus description textarea/input
          if (descriptionInput.value && typeof descriptionInput.value.focus === 'function') {
            descriptionInput.value.focus();
            return;
          }
          const el = descriptionInput.value?.$el || descriptionInput.value;
          const input = el?.querySelector ? el.querySelector('textarea, input') : null;
          if (input && typeof input.focus === 'function') {
            input.focus();
            return;
          }
        }

        if (val === 'TimeEvent') {
          // focus hour input
          if (hourInput.value && typeof hourInput.value.focus === 'function') {
            hourInput.value.focus();
            return;
          }
          const el = hourInput.value?.$el || hourInput.value;
          const input = el?.querySelector ? el.querySelector('input') : null;
          if (input && typeof input.focus === 'function') {
            input.focus();
            return;
          }
        }
      } catch (e) {
        // ignore
      }
    });
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
        timeMode: val.timeMode || 'event',
        timeOffsetDays: val.timeOffsetDays == null ? 7 : val.timeOffsetDays,
        id: val.id,
      };
      // Populate repeat-related form fields from canonical `repeat` object if present
      try {
        if (val.repeat && typeof val.repeat === 'object') {
          repeatMode.value = 'cyclic';
          const incomingCycle = val.repeat.cycleType || 'dayWeek';
          // Map legacy cycle names to new UI choices
          if (incomingCycle === 'month') {
            repeatCycleType.value = 'nth';
            // If seed eventDate has a day, set it
            try {
              const ev = val.repeat.eventDate || val.eventDate || val.date || null;
              if (ev) {
                const d = new Date(ev);
                if (!isNaN(d.getTime())) everyNDayOfMonth.value = d.getDate();
              }
            } catch (e) {
              // ignore
            }
          } else if (incomingCycle === 'other' || incomingCycle === 'year') {
            repeatCycleType.value = 'interval';
            if (typeof val.repeat.intervalDays === 'number')
              repeatIntervalDays.value = val.repeat.intervalDays;
          } else {
            repeatCycleType.value = incomingCycle;
          }
          repeatDays.value = Array.isArray(val.repeat.days) ? [...val.repeat.days] : [];
          // load seed if present (used for interval calculations)
          try {
            if (val.repeat && val.repeat.eventDate) {
              // nothing special to do here
            }
          } catch (e) {
            // ignore
          }
          // load interval days if present
          try {
            if (typeof val.repeat.intervalDays === 'number')
              repeatIntervalDays.value = val.repeat.intervalDays;
            else repeatIntervalDays.value = null;
          } catch (e) {
            repeatIntervalDays.value = null;
          }
          // Prefer eventDate from repeat seed if not set on task
          if (!localNewTask.value.eventDate && val.repeat.eventDate) {
            localNewTask.value.eventDate = val.repeat.eventDate;
          }
        } else {
          repeatMode.value = 'oneTime';
          repeatCycleType.value = 'dayWeek';
          repeatDays.value = [];
          everyNDayOfMonth.value = null;
        }
      } catch (e) {
        repeatMode.value = 'oneTime';
        repeatCycleType.value = 'dayWeek';
        repeatDays.value = [];
        repeatIntervalDays.value = null;
        everyNDayOfMonth.value = null;
      }
      // If the incoming task has a seeded repeat/event date, prefer that saved day
      try {
        const savedEv =
          (val && val.repeat && (val.repeat.eventDate || val.repeat.date)) ||
          val.eventDate ||
          val.date ||
          null;
        if (savedEv) {
          const ds = new Date(savedEv);
          if (!isNaN(ds.getTime())) {
            everyNDayOfMonth.value = ds.getDate();
          }
        }
      } catch (e) {
        // ignore
      }

      // Ensure nth/day seed is restored for edit mode if applicable (fallback)
      try {
        if (repeatCycleType.value === 'nth' && !everyNDayOfMonth.value) {
          const ev = localNewTask.value.eventDate || props.selectedDate || null;
          if (ev) {
            const d = new Date(ev);
            if (!isNaN(d.getTime())) {
              everyNDayOfMonth.value = d.getDate();
            }
          }
        }
      } catch (e) {
        // ignore
      }

      emit('update:mode', 'edit');
    } else {
      // switch back to add mode and reset fields
      emit('update:mode', 'add');
      // preserve currently selected type so the chooser doesn't jump back to default
      const prevType = lastSelectedType.value || localNewTask.value?.type_id || 'TimeEvent';
      // keep date if provided via selectedDate prop
      localNewTask.value = {
        name: '',
        description: '',
        type_id: prevType,
        status_id: 1,
        parent_id: null,
        created_by: '',
        priority: 'medium',
        groupId: props.activeGroup?.value ?? undefined,
        eventDate:
          props.selectedDate ||
          `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
        eventTime: '',
        timeMode: 'event',
        timeOffsetDays: 7,
      };
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
    // Use full 4-digit year from eventDateParts to avoid two-digit-year pitfalls
    let year = Number(eventDateParts.value[0]) || currentYear;
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

// Returns a simple day-only difference between the given date and today
const getTimeDifferenceDisplay = (dayDate: string) => {
  if (!dayDate) return 'Select a date';

  const date = new Date(dayDate);
  const today = new Date();

  // Normalize both dates to midnight for accurate day comparison
  const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const daysDiff = Math.round(
    (dateNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysDiff === 0) return 'TODAY';
  if (daysDiff === 1) return 'TOMORROW';
  if (daysDiff === -1) return 'YESTERDAY';

  if (daysDiff > 0) {
    return `In ${daysDiff} ${daysDiff === 1 ? 'day' : 'days'}`;
  }

  const absDays = Math.abs(daysDiff);
  return `${absDays} ${absDays === 1 ? 'day' : 'days'} ago`;
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
  // Expose only the last two digits in the input, but keep full 4-digit year in storage.
  get: () => {
    const full = eventDateParts.value[0]
      ? Number(eventDateParts.value[0])
      : new Date().getFullYear();
    const two = String(full).slice(-2);
    return Number(two);
  },
  set: (val: number) => {
    if (eventDateParts.value.length === 3) {
      let yearNum = Number(val);
      if (!isNaN(yearNum)) {
        // If user provided a 2-digit year (0-99), map to current century.
        if (yearNum >= 0 && yearNum <= 99) {
          const baseCentury = Math.floor(new Date().getFullYear() / 100) * 100;
          yearNum = baseCentury + yearNum;
        }
        localNewTask.value.eventDate = `${String(yearNum).padStart(4, '0')}-${eventDateParts.value[1]}-${eventDateParts.value[2]}`;
      }
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
  Replenish: '#c9a676', // yellow
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

// When creating new tasks, keep the form open after save by default
const stayAfterSave = ref(false);

// When user switches into Replenish type while in add mode, automatically
// enable "Stay after save" so creating multiple replenish items is easier.
watch(isReplenish, (newVal, oldVal) => {
  try {
    if (newVal && !oldVal && props.mode === 'add') {
      stayAfterSave.value = true;
    }
  } catch (e) {
    // ignore
  }
});
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

// When user switches the repeat cycle type, set sensible defaults for month/year
watch(repeatCycleType, (val) => {
  try {
    if (val === 'interval') {
      if (
        !everyNDayOfMonth.value &&
        (repeatIntervalDays.value == null || repeatIntervalDays.value === 0)
      ) {
        repeatIntervalDays.value = 30;
      }
    }
    if (val === 'nth') {
      try {
        if (!everyNDayOfMonth.value) {
          // Prefer the current event date day, otherwise fall back to selectedDate prop
          const dayNum = Number(eventDateDay.value) || null;
          if (dayNum && !isNaN(dayNum)) {
            everyNDayOfMonth.value = dayNum;
          } else if (props.selectedDate) {
            const parts = String(props.selectedDate).split('-');
            if (parts.length === 3) everyNDayOfMonth.value = Number(parts[2]);
          }
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
});

onMounted(() => {
  adjustDescriptionHeight();
});

function onSubmit(event: Event) {
  event.preventDefault();
  // Prevent creating Notes — show message instead
  if (localNewTask.value.type_id === 'NoteLater') {
    try {
      $q.notify({ type: 'info', message: 'Notes needs to be redesigned and coded in some future' });
    } catch (e) {
      // ignore notify failures
    }
    return;
  }
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
      let outCycle = repeatCycleType.value as string;
      const repeatObj: any = {
        days: Array.isArray(repeatDays.value) ? [...repeatDays.value] : [],
      };

      if (repeatCycleType.value === 'interval') {
        if (everyNDayOfMonth.value) {
          outCycle = 'month';
          try {
            const base = localNewTask.value.eventDate || '';
            const parts = base.split('-');
            if (parts.length === 3) {
              parts[2] = String(everyNDayOfMonth.value).padStart(2, '0');
              repeatObj.eventDate = parts.join('-');
            } else {
              repeatObj.eventDate = localNewTask.value.eventDate || null;
            }
          } catch (e) {
            repeatObj.eventDate = localNewTask.value.eventDate || null;
          }
        } else {
          outCycle = 'other';
          if (typeof repeatIntervalDays.value === 'number')
            repeatObj.intervalDays = repeatIntervalDays.value;
          repeatObj.eventDate = localNewTask.value.eventDate || null;
        }
      } else if (repeatCycleType.value === 'nth') {
        outCycle = 'month';
        try {
          const base = localNewTask.value.eventDate || '';
          const parts = base.split('-');
          if (parts.length === 3 && everyNDayOfMonth.value) {
            parts[2] = String(everyNDayOfMonth.value).padStart(2, '0');
            repeatObj.eventDate = parts.join('-');
          } else {
            repeatObj.eventDate = localNewTask.value.eventDate || null;
          }
        } catch (e) {
          repeatObj.eventDate = localNewTask.value.eventDate || null;
        }
      } else {
        outCycle = repeatCycleType.value as string;
        repeatObj.eventDate = localNewTask.value.eventDate || null;
      }

      payload.repeat = {
        cycleType: outCycle,
        ...repeatObj,
      };
    } else {
      payload.repeat = null;
    }
    emit('add-task', payload, { preview: !stayAfterSave.value });
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
      let outCycle = repeatCycleType.value as string;
      const repeatObj: any = {
        days: Array.isArray(repeatDays.value) ? [...repeatDays.value] : [],
      };

      if (repeatCycleType.value === 'interval') {
        if (everyNDayOfMonth.value) {
          outCycle = 'month';
          try {
            const base = localNewTask.value.eventDate || '';
            const parts = base.split('-');
            if (parts.length === 3) {
              parts[2] = String(everyNDayOfMonth.value).padStart(2, '0');
              repeatObj.eventDate = parts.join('-');
            } else {
              repeatObj.eventDate = localNewTask.value.eventDate || null;
            }
          } catch (e) {
            repeatObj.eventDate = localNewTask.value.eventDate || null;
          }
        } else {
          outCycle = 'other';
          if (typeof repeatIntervalDays.value === 'number')
            repeatObj.intervalDays = repeatIntervalDays.value;
          repeatObj.eventDate = localNewTask.value.eventDate || null;
        }
      } else if (repeatCycleType.value === 'nth') {
        outCycle = 'month';
        try {
          const base = localNewTask.value.eventDate || '';
          const parts = base.split('-');
          if (parts.length === 3 && everyNDayOfMonth.value) {
            parts[2] = String(everyNDayOfMonth.value).padStart(2, '0');
            repeatObj.eventDate = parts.join('-');
          } else {
            repeatObj.eventDate = localNewTask.value.eventDate || null;
          }
        } catch (e) {
          repeatObj.eventDate = localNewTask.value.eventDate || null;
        }
      } else {
        outCycle = repeatCycleType.value as string;
        repeatObj.eventDate = localNewTask.value.eventDate || null;
      }

      updated.repeat = {
        cycleType: outCycle,
        ...repeatObj,
      };
    } else {
      updated.repeat = null;
    }
    // Emit update; parent will switch to preview and clear edit selection
    emit('update-task', updated);
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
      <div v-if="isReplenish && (mode === 'edit' || mode === 'add')" style="margin-bottom: 8px">
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
          <span style="font-weight: 500">{{ localNewTask.name || 'Untitled' }}</span>
        </div>
        <div style="margin-left: auto; display: flex; gap: 8px; align-items: center">
          <q-btn
            dense
            unelevated
            color="primary"
            icon="visibility"
            label="Preview"
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
                          class="text-h7 text-primary text-weight-bold"
                        >
                          {{ getTimeDifferenceDisplay(localNewTask.eventDate) }}
                        </div>
                        <div class="col-auto" v-if="repeatMode !== 'cyclic'">
                          <q-checkbox
                            v-model="autoIncrementYear"
                            dense
                            size="xs"
                            label="Auto Year"
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
                            label="Nth day"
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
                              Repeats every month on day {{ everyNDayOfMonth }} (uses the last day
                              of the month when that day doesn't exist).
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
                            label="Cycle (days)"
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
                        v-if="!(repeatMode === 'cyclic' && repeatCycleType === 'nth')"
                        class="row q-gutter-xs items-center"
                        style="align-items: center"
                      >
                        <div
                          class="row q-gutter-xs date-inputs-row"
                          style="gap: 8px; align-items: center; flex-wrap: nowrap; overflow-x: auto"
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
                            label="Day"
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
                            label="Month"
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
                            label="Year"
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
                          label="Days before"
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
                              <q-item-section side style="display: flex; align-items: center">
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
                                  <q-icon v-if="cs.id === 'transparent'" name="close" size="14px" />
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
                            localNewTask.priority === option.value ? option.background : 'grey-3'
                          "
                          :text-color="
                            localNewTask.priority === option.value ? option.textColor : 'grey-7'
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
                              localNewTask.priority === option.value ? option.textColor : undefined,
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
                          :label="
                            mode === 'add' ? 'New item' : mode === 'edit' ? 'Update' : 'Preview'
                          "
                          :disable="mode === 'preview'"
                          :style="`background: ${submitColor} !important; background-color: ${submitColor} !important; border-color: ${submitColor} !important; color: ${submitTextColor} !important;`"
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
                        <q-checkbox
                          v-if="mode === 'add'"
                          v-model="stayAfterSave"
                          dense
                          class="q-ml-sm"
                          label="Stay after save"
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
                        <div v-if="mode === 'add'" class="text-caption text-grey-7 q-ml-md">
                          <q-icon name="info" size="xs" class="q-mr-xs" />
                          Group:
                          <div style="display: inline-block; margin-left: 8px">
                            <q-chip
                              size="sm"
                              icon="folder"
                              class="q-pointer"
                              clickable
                              @click.stop="groupMenu = true"
                            >
                              {{
                                (localNewTask.groupId &&
                                  (groups || []).find((g) => g.id === localNewTask.groupId)
                                    ?.name) ||
                                (activeGroup && activeGroup.label.split(' (')[0]) ||
                                'No group'
                              }}
                            </q-chip>
                            <q-menu
                              v-model="groupMenu"
                              anchor="bottom right"
                              self="top right"
                              class="group-menu"
                            >
                              <q-list dense separator>
                                <q-item clickable dense @click="() => selectGroupForAdd(null)">
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
                                    <div style="font-weight: 600">No group</div>
                                  </q-item-section>
                                </q-item>
                                <q-separator />
                                <q-item
                                  v-for="g in groups || []"
                                  :key="g.id"
                                  clickable
                                  dense
                                  @click="() => selectGroupForAdd(g.id)"
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
                                    <q-icon name="folder" />
                                  </q-item-section>
                                  <q-item-section>
                                    <div style="font-weight: 600">{{ g.name }}</div>
                                  </q-item-section>
                                </q-item>
                              </q-list>
                            </q-menu>
                          </div>
                        </div>

                        <div v-else-if="mode === 'edit'" class="text-caption text-grey-7 q-ml-md">
                          <q-icon name="info" size="xs" class="q-mr-xs" />
                          Task will be updated in:
                          <div style="display: inline-block; margin-left: 8px">
                            <q-chip
                              size="sm"
                              icon="folder"
                              class="q-pointer"
                              clickable
                              @click.stop="groupMenu = true"
                            >
                              {{
                                (localNewTask.groupId &&
                                  (groups || []).find((g) => g.id === localNewTask.groupId)
                                    ?.name) ||
                                activeGroup?.label?.split(' (')[0] ||
                                'No group'
                              }}
                            </q-chip>
                            <q-menu
                              v-model="groupMenu"
                              anchor="bottom right"
                              self="top right"
                              class="group-menu"
                            >
                              <q-list dense separator>
                                <q-item clickable dense @click="() => selectGroupForEdit(null)">
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
                                    <div style="font-weight: 600">No group</div>
                                  </q-item-section>
                                </q-item>
                                <q-separator />
                                <q-item
                                  v-for="g in groups || []"
                                  :key="g.id"
                                  clickable
                                  dense
                                  @click="() => selectGroupForEdit(g.id)"
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
                                    <q-icon name="folder" />
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
                    </div>
                  </div>
                </div>
                <!-- Priority and Type column to the right of date/time -->
                <div class="col-3 col-md-3 col-sm-3 col-xs-3">
                  <q-card class="q-pa-sm">
                    <div class="text-caption text-grey-7 q-mb-xs">Task type</div>
                    <div class="column">
                      <q-btn
                        v-for="opt in typeOptions"
                        :key="opt.value"
                        :label="showFullTypeLabel ? opt.label : opt.shortLabel || opt.label"
                        :aria-label="opt.label"
                        :icon="opt.icon"
                        :size="btnSize"
                        class="full-width type-btn q-mb-sm"
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
/* Replenishment sizing now handled by ReplenishmentList component via `size` prop */
.add-task-card {
  position: relative;
  overflow: hidden; /* prevent large watermark from creating horizontal scroll */
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
::v-deep .type-btn .q-btn__content {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 2px !important;
}
::v-deep .type-btn .q-btn__content .q-icon {
  margin-right: 0 !important;
  margin-top: 6px !important;
  margin-bottom: 2px !important;
  font-size: 22px !important;
}
::v-deep .type-btn .q-btn__label {
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
  border: 1px solid transparent !important;
  box-sizing: border-box !important;
  padding-left: 6px !important;
  padding-right: 6px !important;
}
.priority-btn.q-btn--active,
.priority-btn.q-btn--unelevated,
.priority-btn.q-btn--outline {
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
::v-deep .priority-btn .q-btn__content {
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px !important;
}
::v-deep .priority-btn .q-btn__content .q-icon {
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
::v-deep .time-toggle .q-btn__content,
::v-deep .time-toggle .q-btn__content .q-btn__label {
  font-size: 12px !important;
  line-height: 1 !important;
  padding: 0 !important;
  text-transform: none !important;
}
::v-deep .time-toggle .q-btn__content .q-icon,
::v-deep .time-toggle .q-icon {
  font-size: 18px !important;
  width: auto !important;
  height: auto !important;
  margin: 0 0 6px 0 !important;
  display: block !important;
}

/* Extra override: ensure no inherited margin on q-icon inside time-toggle buttons */
::v-deep .time-toggle .q-btn__content .q-icon:not([style]) {
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
