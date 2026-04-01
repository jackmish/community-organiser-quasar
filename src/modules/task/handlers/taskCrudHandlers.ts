import type { Ref } from 'vue';
import type { Task } from 'src/modules/task/models/TaskModel';
import CC from 'src/CentralController';
import { clampDateToMonth } from 'src/utils/dateUtils';

/** Normalise a task payload's date fields in-place and return the safe target date. */
function normalizeTaskDates(targetDate: string, taskPayload: any): string {
  const safeTarget = clampDateToMonth(targetDate) ?? targetDate;
  if (taskPayload) {
    if (taskPayload.date) taskPayload.date = clampDateToMonth(taskPayload.date) ?? taskPayload.date;
    if (taskPayload.eventDate)
      taskPayload.eventDate = clampDateToMonth(taskPayload.eventDate) ?? taskPayload.eventDate;
  }
  return safeTarget;
}

export function createTaskCrudHandlers(args: {
  setCurrentDate: (d: string | null) => void;
  activeGroup: Ref<any>;
  currentDate: Ref<string>;
  allTasks: Ref<any[]>;
  quasar: any;
  active: {
    task: Ref<Task | null>;
    mode: Ref<'add' | 'edit' | 'preview'>;
    setTask?: (t: Task | null) => void;
    setMode?: (m: 'add' | 'edit' | 'preview') => void;
  };
}) {
  const { setCurrentDate, activeGroup, currentDate, allTasks, quasar, active } = args;
  const { task: taskToEdit, mode } = active;
  // Wrap to preserve `this` when active is a class instance (e.g. TaskActive)
  const setTask = active.setTask ? (t: Task | null) => active.setTask!(t) : undefined;
  const setMode = active.setMode
    ? (m: 'add' | 'edit' | 'preview') => active.setMode!(m)
    : undefined;

  const handleAddTask = async (taskPayload: any, opts?: { preview?: boolean }) => {
    const groupIdToUse = taskPayload?.groupId ?? activeGroup.value?.value ?? null;
    if (groupIdToUse === null || groupIdToUse === undefined) {
      try {
        quasar.notify({
          type: 'warning',
          message: 'Please select an active group first (not "All Groups")',
          position: 'top',
        });
      } catch (e) {
        // ignore
      }
      return;
    }

    if (!taskPayload || !taskPayload.name) return;

    const rawTargetDate =
      (taskPayload && (taskPayload.date || taskPayload.eventDate)) || currentDate.value;
    const taskData: any = {
      ...taskPayload,
      date: taskPayload?.date || taskPayload?.eventDate || rawTargetDate,
      groupId: groupIdToUse,
    };
    const targetDate = normalizeTaskDates(rawTargetDate, taskData);

    let created: any = null;
    try {
      created = await CC.task.add(targetDate, taskData);
    } catch (err) {
      try {
        quasar.notify({ type: 'negative', message: 'Failed to save task', position: 'top' });
      } catch (e) {
        // ignore notify failures
      }
      // log and swallow to avoid unhandled rejection
      console.error('handleAddTask: api.task.add failed', err);
      return;
    }
    if (opts && opts.preview && created) {
      if (setTask) setTask(created);
      else taskToEdit.value = created;
      mode.value = 'preview';
      try {
        setCurrentDate(created?.date || created?.eventDate || null);
      } catch (e) {
        // ignore
      }
    }
  };

  const handleUpdateTask = async (updatedTask: any) => {
    if (!updatedTask || !updatedTask.id) return;
    const { id, ...rest } = updatedTask;
    const rawTargetDate =
      (updatedTask.date as string) || (updatedTask.eventDate as string) || currentDate.value;
    const updatedPayload = { ...updatedTask };
    const targetDate = normalizeTaskDates(rawTargetDate, updatedPayload);
    await CC.task.update(targetDate, updatedPayload);
    const updated = (allTasks.value || []).find((t) => t.id === updatedTask.id) || null;
    if (setTask) setTask(updated);
    else taskToEdit.value = updated;
    if (updated) {
      mode.value = 'preview';
    } else {
      mode.value = 'add';
    }
  };

  return { handleAddTask, handleUpdateTask } as const;
}
