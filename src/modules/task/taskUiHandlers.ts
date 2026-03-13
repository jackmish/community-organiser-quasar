import type { Ref } from 'vue';
import type { Task } from '../day-organiser';
import { getCycleType } from 'src/modules/task/utils/occursOnDay';

export function createTaskUiHandlers(args: {
  activeTask: Ref<Task | null>;
  activeMode: Ref<'add' | 'edit' | 'preview'>;
  setActiveTask?: (t: Task | null) => void;
  panelHidden: Ref<boolean>;
  currentDate: Ref<string>;
}) {
  const { activeTask, activeMode, setActiveTask, panelHidden, currentDate } = args;

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
