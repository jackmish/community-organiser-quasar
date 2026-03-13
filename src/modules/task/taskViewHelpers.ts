import type { Ref } from 'vue';
import { ref, computed, watch } from 'vue';
import { useLongPress } from 'src/composables/useLongPress';
import type { Task } from '../day-organiser';
import { todayString } from 'src/utils/dateUtils';

export function createTaskViewHelpers(args: {
  currentDate: Ref<string>;
  currentDayData: Ref<any>;
  setTaskToEdit: (t: Task) => void;
  editTask: (t: Task) => void;
}) {
  const { currentDate, currentDayData, setTaskToEdit, editTask } = args;

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
    eventDate: todayString(),
    eventTime: '',
  });

  const typeOptions = [
    { label: 'Command center', value: 'Command center', icon: 'dashboard' },
    { label: 'Note', value: 'Note/Later', icon: 'note' },
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
  } as const;
}
