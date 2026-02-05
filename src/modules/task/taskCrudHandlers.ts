import type { Ref } from 'vue';
import type { Task } from 'src/modules/task/types';
import * as api from 'src/modules/day-organiser/dayOrganiserApi';

export function createTaskCrudHandlers(args: {
  setCurrentDate: (d: string | null) => void;
  activeGroup: Ref<any>;
  currentDate: Ref<string>;
  allTasks: Ref<any[]>;
  quasar: any;
  taskToEdit: Ref<Task | null>;
  mode: Ref<'add' | 'edit' | 'preview'>;
  selectedTaskId: Ref<string | null>;
}) {
  const {
    setCurrentDate,
    activeGroup,
    currentDate,
    allTasks,
    quasar,
    taskToEdit,
    mode,
    selectedTaskId,
  } = args;

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

    const targetDate =
      (taskPayload && (taskPayload.date || taskPayload.eventDate)) || currentDate.value;
    const taskData: any = {
      ...taskPayload,
      date: taskPayload?.date || taskPayload?.eventDate || targetDate,
      groupId: groupIdToUse,
    };

    const created = await api.task.add(targetDate, taskData);
    if (opts && opts.preview && created) {
      taskToEdit.value = created;
      mode.value = 'preview';
      selectedTaskId.value = created.id;
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
    const targetDate =
      (updatedTask.date as string) || (updatedTask.eventDate as string) || currentDate.value;
    await api.task.update(targetDate, id, rest);
    const updated = (allTasks.value || []).find((t) => t.id === id) || null;
    taskToEdit.value = updated;
    if (updated) {
      mode.value = 'preview';
      selectedTaskId.value = id;
    } else {
      mode.value = 'add';
      selectedTaskId.value = null;
    }
  };

  return { handleAddTask, handleUpdateTask } as const;
}
