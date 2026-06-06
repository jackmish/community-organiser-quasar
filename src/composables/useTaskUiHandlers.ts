import type { Ref } from 'vue';
import type { Task } from 'src/modules/task/models/TaskModel';
import { getCycleType } from 'src/modules/task/utils/occursOnDay';

export function useTaskUiHandlers(args: {
  activeTask: Ref<Task | null>;
  activeMode: Ref<'add' | 'edit' | 'preview'>;
  setActiveTask?: (t: Task | null) => void;
  panelHidden: Ref<boolean>;
  currentDate: Ref<string>;
  /** When true, preview stays inline and does not open the fixed side panel. */
  inlinePreview?: Ref<boolean>;
}) {
  const { activeTask, activeMode, setActiveTask, panelHidden, currentDate, inlinePreview } = args;

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
    if (!inlinePreview?.value) panelHidden.value = false;
  }

  function editTask(task: Task) {
    if (setActiveTask) setActiveTask(task);
    else activeTask.value = task;
    activeMode.value = 'edit';
    panelHidden.value = false;
  }

  /** Close preview/edit without opening the new-task form. */
  function closeTaskPanel() {
    if (setActiveTask) setActiveTask(null);
    else activeTask.value = null;
    activeMode.value = 'preview';
    panelHidden.value = true;
  }

  function clearTaskToEdit() {
    closeTaskPanel();
  }

  return { setTaskToEdit, editTask, clearTaskToEdit, closeTaskPanel } as const;
}

/** @deprecated Import from src/composables/useTaskUiHandlers instead. */
export const createTaskUiHandlers = useTaskUiHandlers;
