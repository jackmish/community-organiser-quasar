import type { Ref } from 'vue';
import type { Task } from '../day-organiser';
import { getCycleType } from 'src/utils/occursOnDay';

export function createTaskUiHandlers(args: {
  taskToEdit: Ref<Task | null>;
  mode: Ref<'add' | 'edit' | 'preview'>;
  panelHidden: Ref<boolean>;
  selectedTaskId: Ref<string | null>;
  currentDate: Ref<string>;
  setCurrentDate: (d: string | null) => void;
}) {
  const { taskToEdit, mode, panelHidden, selectedTaskId, currentDate, setCurrentDate } = args;

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

    taskToEdit.value = toShow;
    mode.value = 'preview';
    panelHidden.value = false;
    selectedTaskId.value = toShow.id;
  }

  function editTask(task: Task) {
    taskToEdit.value = task;
    mode.value = 'edit';
    panelHidden.value = false;
    selectedTaskId.value = task.id;
  }

  function clearTaskToEdit() {
    taskToEdit.value = null;
    mode.value = 'add';
    selectedTaskId.value = null;
    panelHidden.value = false;
  }

  return { setTaskToEdit, editTask, clearTaskToEdit } as const;
}
