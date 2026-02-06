import type { Ref } from 'vue';
import type { Task } from 'src/modules/day-organiser';

export function createCalendarHandlers(args: {
  isClickBlocked: Ref<boolean>;
  newTask: Ref<any>;
  setCurrentDate: (d: string | null) => void;
  allTasks: Ref<any[]>;
  editTask?: (t: Task) => void;
  setTask?: (t: Task | null) => void;
  activeMode?: Ref<'add' | 'edit' | 'preview'>;
  setPreviewTask?: (v: any) => void;
  notify?: (opts: any) => void;
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
    notify,
  } = args;

  function selectCalendarDate(dateString: string) {
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

  function handleCalendarDateSelect(dateString: string) {
    selectCalendarDate(dateString);
  }

  function handleCalendarEdit(taskId: string | null) {
    if (!taskId) return;
    const found = (allTasks?.value || []).find((t) => t.id === String(taskId));
    if (found && editTask) editTask(found);
  }

  function handleCalendarPreview(payload: any) {
    if (!payload) return;
    let found: Task | null = null;
    try {
      if (typeof payload === 'string' || typeof payload === 'number') {
        const sid = String(payload);
        found = (allTasks?.value || []).find((t) => t.id === sid) || null;
      } else if (payload && payload.id) {
        const sid = String(payload.id);
        const base = (allTasks?.value || []).find((t) => t.id === sid) || null;
        if (base) {
          const f: Task = { ...base };
          const occ = payload.date || payload._date || payload._dateStr || payload.eventDate;
          if (occ) f.date = occ;
          found = f;
        } else {
          found = payload as Task;
        }
      }
    } catch (e) {
      found = null;
    }
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
    selectCalendarDate,
    handleCalendarDateSelect,
    handleCalendarEdit,
    handleCalendarPreview,
  } as const;
}
