import type { Ref } from 'vue';
import type { Task } from 'src/modules/day-organiser';
import { resolveTask } from 'src/utils/taskResolve';

export function createCalendarHandlers(args: {
  isClickBlocked: Ref<boolean>;
  newTask: Ref<any>;
  setCurrentDate: (d: string | null) => void;
  allTasks: Ref<any[]>;
  editTask?: (t: Task) => void;
  setTask?: (t: Task | null) => void;
  activeMode?: Ref<'add' | 'edit' | 'preview'>;
  setPreviewTask?: (v: any) => void;
}) {
  const {
    isClickBlocked,
    newTask,
    setCurrentDate,
    allTasks,
    editTask,
    setTask,
    activeMode,
    setPreviewTask,
  } = args;

  function handleCalendarDateSelect(dateString: string) {
    if (isClickBlocked?.value) return;
    if (newTask && newTask.value && newTask.value.eventDate !== dateString) {
      if (isClickBlocked) isClickBlocked.value = true;
      if (newTask && newTask.value) newTask.value.eventDate = dateString;
      try {
        setCurrentDate(dateString);
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        if (isClickBlocked) isClickBlocked.value = false;
      }, 100);
    }
  }

  function handleCalendarEdit(taskId: string | null) {
    if (!taskId) return;
    const found = (allTasks?.value || []).find((t) => t.id === String(taskId));
    if (found && editTask) editTask(found);
  }

  function handleCalendarPreview(payload: any) {
    if (!payload) return;
    const found = resolveTask(payload, allTasks);
    if (found) {
      try {
        if (setTask) setTask(found);
        else if (editTask) editTask(found);
        if (activeMode) activeMode.value = 'preview';
        try {
          setCurrentDate(found.date || found.eventDate || null);
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    }
    try {
      if (setPreviewTask) setPreviewTask(null);
    } catch (e) {
      // ignore
    }
  }

  return {
    handleCalendarDateSelect,
    handleCalendarEdit,
    handleCalendarPreview,
  } as const;
}
