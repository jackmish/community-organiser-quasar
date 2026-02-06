import type { Ref } from 'vue';
import { ref, computed, watch } from 'vue';
import { format } from 'date-fns';
import { useLongPress } from 'src/composables/useLongPress';
import type { Task } from '../day-organiser';
import { getCycleType } from 'src/modules/task/utlils/occursOnDay';

export function createTaskUiHandlers(args: {
  activeTask: Ref<Task | null>;
  activeMode: Ref<'add' | 'edit' | 'preview'>;
  setActiveTask?: (t: Task | null) => void;
  panelHidden: Ref<boolean>;
  currentDate: Ref<string>;
  setCurrentDate: (d: string | null) => void;
}) {
  const { activeTask, activeMode, setActiveTask, panelHidden, currentDate, setCurrentDate } = args;

  function setTaskToEdit(task: Task) {
    let toShow: Task = task;
    try {
      const cycle = getCycleType(task as any);
      if (cycle) {
        toShow = { ...(task as any) } as Task;
        (toShow as any).date = currentDate.value;
      }
    } catch (e) {
      // ignore and fall back to the original task
    }

    if (setActiveTask) setActiveTask(toShow);
    else activeTask.value = toShow;
    activeMode.value = 'preview';
    panelHidden.value = false;
    // selected task id is represented by active.task
  }

  function editTask(task: Task) {
    if (setActiveTask) setActiveTask(task);
    else activeTask.value = task;
    activeMode.value = 'edit';
    panelHidden.value = false;
  }

  function clearTaskToEdit() {
    if (setActiveTask) setActiveTask(null);
    else activeTask.value = null;
    activeMode.value = 'add';
    panelHidden.value = false;
  }

  return { setTaskToEdit, editTask, clearTaskToEdit } as const;
}

// Create view-related refs and helpers for task add/preview UI
export function createTaskViewHelpers(args: {
  currentDate: Ref<string>;
  setCurrentDate: (d: string | null) => void;
  currentDayData: Ref<any>;
  allTasks: Ref<any[]>;
  groups: Ref<any[]>;
  activeGroup: Ref<any>;
  getGroupsByParent: (id?: string) => any[];
  setTaskToEdit: (t: Task) => void;
  editTask: (t: Task) => void;
}) {
  const {
    currentDate,
    setCurrentDate,
    currentDayData,
    allTasks,
    groups,
    activeGroup,
    getGroupsByParent,
    setTaskToEdit,
    editTask,
  } = args;

  const timeType = ref<'wholeDay' | 'exactHour'>('wholeDay');
  const isClickBlocked = ref(false);
  const newTask = ref({
    name: '',
    description: '',
    type_id: 'TimeEvent',
    status_id: '',
    parent_id: null as string | null,
    created_by: '',
    priority: 'medium' as Task['priority'],
    completed: false,
    groupId: undefined as string | undefined,
    eventDate: format(new Date(), 'yyyy-MM-dd'),
    eventTime: '',
  });

  const typeOptions = [
    { label: 'Command center', value: 'Command center', icon: 'dashboard' },
    { label: 'Note/Later', value: 'Note/Later', icon: 'note' },
    { label: 'TimeEvent', value: 'TimeEvent', icon: 'event' },
    { label: 'Replenishment', value: 'Replenishment', icon: 'shopping_cart' },
  ];

  const parentTaskOptions = computed(() => {
    const val = (
      currentDayData.value && currentDayData.value.tasks ? currentDayData.value.tasks : []
    ).map((task: any) => ({
      label: task.name,
      value: task.id,
      icon: typeOptions.find((t) => t.value === task.category)?.icon || 'task',
    }));
    return val;
  });

  const filteredParentOptions = ref(parentTaskOptions.value);
  watch(parentTaskOptions, (newOptions) => {
    filteredParentOptions.value = newOptions;
  });

  // Long-press handling via composable
  const { longPressTriggered, setLongPressHandler } = useLongPress();
  // Register page's edit handler with the composable
  setLongPressHandler(editTask);

  function handleTaskClick(task: Task) {
    if (longPressTriggered.value) {
      longPressTriggered.value = false;
      return;
    }
    setTaskToEdit(task);
  }

  // Watch timeType to clear time when "Whole Day" is selected
  watch(timeType, (newValue) => {
    if (newValue === 'wholeDay') {
      try {
        (newTask.value as any).eventTime = '';
      } catch (e) {
        // ignore
      }
    }
  });

  const parseYmdLocal = (s: string | undefined | null): Date | null => {
    if (!s || typeof s !== 'string') return null;
    const parts = s.split('-');
    if (parts.length < 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m - 1, d);
  };

  const getTimeOffsetDaysForTask = (t: any): number => {
    const raw = t && t.timeOffsetDays;
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = Number(raw);
    return isNaN(n) ? 0 : Math.max(0, Math.floor(n));
  };

  const filterParentTasks = (val: string, update: (fn: () => void) => void) => {
    update(() => {
      if (val === '') {
        filteredParentOptions.value = parentTaskOptions.value;
      } else {
        const needle = val.toLowerCase();
        filteredParentOptions.value = parentTaskOptions.value.filter(
          (option: { label: string }) => option.label.toLowerCase().indexOf(needle) > -1,
        );
      }
    });
  };

  // Sync calendar date with current date
  watch(currentDate, (newDate) => {
    try {
      if ((newTask.value as any).eventDate !== newDate) (newTask.value as any).eventDate = newDate;
    } catch (e) {
      // ignore
    }
  });

  return {
    timeType,
    isClickBlocked,
    newTask,
    typeOptions,
    parentTaskOptions,
    filteredParentOptions,
    handleTaskClick,
    filterParentTasks,
    parseYmdLocal,
    getTimeOffsetDaysForTask,
  } as const;
}
