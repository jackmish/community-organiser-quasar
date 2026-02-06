import { getCycleType } from './utlils/occursOnDay';
import { watch, ref } from 'vue';
import type { Ref } from 'vue';
import type { Task } from './types';
import type { OrganiserData, DayData } from '../day-organiser/types';

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// (No module-level flat list here) task lists are built from organiser data on demand.

// Reactive flat list exposed for callers that want to observe all tasks.
export const flatTasks = ref<Task[]>([]);

function sanitizeForHistory(value: any, depth = 2): any {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (t === 'function') return '[Function]';
  if (value instanceof Date) return value.toISOString();

  try {
    if (Array.isArray(value)) {
      if (depth <= 0) return '[Array]';
      return value.map((v) =>
        v === null || v === undefined
          ? v
          : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? v
            : v instanceof Date
              ? v.toISOString()
              : sanitizeForHistory(v, depth - 1),
      );
    }

    if (depth <= 0) return '[Object]';

    const out: any = {};
    for (const k of Object.keys(value)) {
      try {
        const v = value[k];
        if (v === null || v === undefined) {
          out[k] = v;
        } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          out[k] = v;
        } else if (v instanceof Date) {
          out[k] = v.toISOString();
        } else if (Array.isArray(v)) {
          out[k] = sanitizeForHistory(v, depth - 1);
        } else if (typeof v === 'function') {
          out[k] = '[Function]';
        } else {
          out[k] = sanitizeForHistory(v, depth - 1);
        }
      } catch (e) {
        out[k] = '[Unserializable]';
      }
    }
    return out;
  } catch (e) {
    return '[Unserializable]';
  }
}

export const addTask = (
  organiserData: OrganiserData,
  date: string,
  taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
): Task => {
  const now = new Date().toISOString();
  const task: Task = {
    ...taskData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  } as Task;

  try {
    const isCyclic = Boolean(getCycleType(task));
    if (isCyclic) {
      (task as any).status_id = 1;
    }
  } catch (e) {
    // ignore
  }

  if (!organiserData.days[date]) {
    organiserData.days[date] = { date, tasks: [], notes: '' } as DayData;
  }
  organiserData.days[date].tasks.push(task);
  return task;
};

export const updateTask = (
  organiserData: OrganiserData,
  date: string,
  taskId: string,
  updates: Partial<Omit<Task, 'id' | 'createdAt'>>,
): void => {
  const getAllDays = organiserData.days;
  let task: any = null;
  let foundDayKey: string | null = null;

  // Try quick path: find in provided date bucket
  if (getAllDays[date] && Array.isArray(getAllDays[date].tasks)) {
    const found = getAllDays[date].tasks.find((t) => t.id === taskId);
    if (found) {
      task = found;
      foundDayKey = date;
    }
  }

  // Fallback: search all days
  if (!task) {
    for (const dKey of Object.keys(getAllDays)) {
      const d = getAllDays[dKey];
      if (!d || !Array.isArray(d.tasks)) continue;
      const found = d.tasks.find((t) => t.id === taskId);
      if (found) {
        task = found;
        foundDayKey = dKey;
        break;
      }
    }
  }

  if (!task) throw new Error('Task not found');

  if (!Array.isArray(task.history)) task.history = [];

  const isCyclic = Boolean(getCycleType(task));
  if (Object.prototype.hasOwnProperty.call(updates, 'status_id')) {
    const newStatus = Number((updates as any).status_id);
    if (isCyclic && newStatus === 0) {
      task.history.push({
        type: 'cycleDone',
        is_done: true,
        date: date,
        changedAt: new Date().toISOString(),
      });
      delete (updates as any).status_id;
    }
  }

  Object.keys(updates).forEach((k) => {
    try {
      const key = k as keyof typeof task;
      const oldVal = task[key];
      const newVal = (updates as any)[key];
      if (oldVal !== newVal) {
        const oldSan = sanitizeForHistory(oldVal);
        const newSan = sanitizeForHistory(newVal);
        const entry: any = { type: 'update', field: key, changedAt: new Date().toISOString() };
        const isPlaceholder = (v: any) =>
          typeof v === 'string' &&
          (v === '[Object]' || v === '[Array]' || v === '[Unserializable]');
        if (!isPlaceholder(oldSan)) entry.old = oldSan;
        if (!isPlaceholder(newSan)) entry.new = newSan;
        task.history.push(entry);
      }
    } catch (e) {
      // ignore
    }
  });

  Object.assign(task, updates, { updatedAt: new Date().toISOString() });
  // no module-level cache update here
  // If the update included a date/eventDate and it's different from the current day,
  // move the task to the target day so it appears under the new date bucket.
  try {
    const targetDate = (updates as any).date || (updates as any).eventDate || date;
    if (targetDate && foundDayKey && String(targetDate) !== String(foundDayKey)) {
      // Remove from old day (use locals to satisfy TS narrowing)
      const oldDay = getAllDays[String(foundDayKey)];
      if (oldDay && Array.isArray(oldDay.tasks)) {
        oldDay.tasks = oldDay.tasks.filter((t) => t.id !== taskId);
      }
      // Ensure target day exists
      const targetKey = String(targetDate);
      let newDay = getAllDays[targetKey];
      if (!newDay) {
        newDay = { date: targetKey, tasks: [], notes: '' };
        getAllDays[targetKey] = newDay;
      }
      // Ensure task's date fields reflect the new day
      try {
        const key = targetKey;
        task.date = key;
        task.eventDate = key;
      } catch (e) {
        // ignore
      }
      // Push task into new day's tasks
      if (Array.isArray(newDay.tasks)) {
        newDay.tasks.push(task);
      }
    }
  } catch (e) {
    // ignore move failures
  }
};

export const deleteTask = (organiserData: OrganiserData, date: string, taskId: string): boolean => {
  try {
    const dayData = organiserData.days[date];
    if (dayData && Array.isArray(dayData.tasks)) {
      const before = dayData.tasks.length;
      dayData.tasks = dayData.tasks.filter((t) => t.id !== taskId);
      if (dayData.tasks.length < before) return true;
    }
  } catch (e) {
    // continue to global search
  }

  let removed = false;
  try {
    for (const dKey of Object.keys(organiserData.days)) {
      const d = organiserData.days[dKey];
      if (!d || !Array.isArray(d.tasks)) continue;
      const before = d.tasks.length;
      d.tasks = d.tasks.filter((t) => t.id !== taskId);
      if (d.tasks.length < before) removed = true;
    }
  } catch (err) {
    // ignore
  }
  // no module-level cache removal here
  return removed;
};

export const toggleTaskComplete = (
  organiserData: OrganiserData,
  date: string,
  taskId: string,
): void => {
  const dayData = organiserData.days[date];
  let task = dayData?.tasks?.find((t) => t.id === taskId);

  if (!task) {
    for (const dKey of Object.keys(organiserData.days)) {
      const d = organiserData.days[dKey];
      if (!d || !Array.isArray(d.tasks)) continue;
      const found = d.tasks.find((t) => t.id === taskId);
      if (found) {
        task = found;
        break;
      }
    }
  }

  if (!task) return;

  try {
    const cur = Number((task as any).status_id);
    const next = cur === 0 ? 1 : 0;
    const isCyclic = Boolean(getCycleType(task));
    if (isCyclic && next === 0) {
      if (!Array.isArray(task.history)) task.history = [];
      task.history.push({
        type: 'cycleDone',
        is_done: true,
        date: date,
        changedAt: new Date().toISOString(),
      });
    } else {
      (task as any).status_id = next;
    }
  } catch (e) {
    (task as any).status_id = 1;
  }
  task.updatedAt = new Date().toISOString();
  // no module-level cache update here
};

export const undoCycleDone = (
  organiserData: OrganiserData,
  date: string,
  taskId: string,
): boolean => {
  try {
    for (const dayKey of Object.keys(organiserData.days)) {
      const day = organiserData.days[dayKey];
      if (!day || !Array.isArray(day.tasks)) continue;
      const task = day.tasks.find((t: any) => t.id === taskId);
      if (task) {
        if (!Array.isArray(task.history)) return false;
        const before = task.history.length;
        task.history = task.history.filter(
          (h: any) => !(h && h.type === 'cycleDone' && h.date === date),
        );
        const after = task.history.length;
        if (after < before) {
          task.updatedAt = new Date().toISOString();
          // no module-level cache update here
          return true;
        }
        return false;
      }
    }
  } catch (err) {
    // ignore
  }
  return false;
};

export const getTasksInRange = (
  organiserData: OrganiserData,
  startDate: string,
  endDate: string,
): Task[] => {
  const tasks: Task[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  Object.keys(organiserData.days).forEach((date) => {
    const current = new Date(date);
    if (current >= start && current <= end) {
      const dayTasks = organiserData.days[date]?.tasks;
      if (dayTasks) tasks.push(...dayTasks);
    }
  });
  return tasks.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.priority.localeCompare(b.priority);
  });
};

export const getAllTasks = (organiserData: OrganiserData): Task[] => {
  const tasks: Task[] = [];
  try {
    Object.keys(organiserData.days).forEach((date) => {
      const dayTasks = organiserData.days[date]?.tasks;
      if (dayTasks) tasks.push(...dayTasks);
    });
  } catch (e) {
    // ignore
  }
  return tasks.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.priority.localeCompare(b.priority);
  });
};

export const rebuildAllTasksList = (daysArg?: Record<string, any>): Task[] => {
  const daysObj = daysArg || {};
  const out: Task[] = [];
  try {
    for (const key of Object.keys(daysObj || {})) {
      const d = daysObj[key];
      if (d && Array.isArray(d.tasks)) out.push(...(d.tasks as Task[]));
    }
  } catch (e) {
    // ignore
  }
  const sorted = out.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.priority.localeCompare(b.priority);
  });
  try {
    flatTasks.value = sorted.slice();
  } catch (e) {
    // ignore
  }
  return sorted;
};

// Resolve a payload (id | Task | null) to a Task or null. Optionally accepts a days map to search.
export const resolveTaskPayload = (
  payload: string | number | Task | null,
  daysArg?: Record<string, any>,
): Task | null => {
  if (payload == null) return null;
  if (typeof payload === 'object') return payload;
  const id = String(payload);
  // Prefer reactive flatTasks if available
  try {
    if (Array.isArray((flatTasks as any).value) && (flatTasks as any).value.length > 0) {
      const found = (flatTasks as any).value.find((t: Task) => String(t.id) === id);
      if (found) return found as Task;
    }
  } catch (e) {
    // ignore
  }
  const days = daysArg || {};
  try {
    for (const k of Object.keys(days)) {
      const d = days[k];
      if (!d || !Array.isArray(d.tasks)) continue;
      const f = d.tasks.find((t: Task) => String(t.id) === id);
      if (f) return f as Task;
    }
  } catch (e) {
    // ignore
  }
  return null;
};

// Apply a payload to provided active refs and optional timeApi: sets task ref, mode ref, and current date.
export const applyActiveSelection = (
  activeTaskRef: Ref<Task | null>,
  activeModeRef: Ref<'add' | 'edit' | 'preview'>,
  timeApi: any,
  payload: string | number | Task | null,
) => {
  try {
    if (payload == null) {
      activeTaskRef.value = null;
      activeModeRef.value = 'add';
      return;
    }
    const found = resolveTaskPayload(
      payload as any,
      timeApi && timeApi.days ? timeApi.days.value : undefined,
    );
    if (found) {
      activeTaskRef.value = found;
      activeModeRef.value = 'preview';
      try {
        if (timeApi && typeof timeApi.setCurrentDate === 'function')
          timeApi.setCurrentDate((found as any).date || (found as any).eventDate || null);
      } catch (e) {
        // ignore
      }
      return;
    }
    if (typeof payload === 'object') {
      activeTaskRef.value = payload;
      activeModeRef.value = 'preview';
      return;
    }
    activeTaskRef.value = null;
    activeModeRef.value = 'add';
  } catch (e) {
    try {
      activeTaskRef.value = null;
      activeModeRef.value = 'add';
    } catch (err) {
      // ignore
    }
  }
};

export const attachDaysWatcher = (daysRef?: Ref<any>, onUpdate?: (tasks: Task[]) => void) => {
  try {
    if (!daysRef || typeof daysRef !== 'object') return () => {};
    // initial call
    try {
      const initial = rebuildAllTasksList((daysRef as any).value || {});
      if (typeof onUpdate === 'function') onUpdate(initial);
    } catch (e) {
      // ignore
    }
    const stop = watch(
      () => (daysRef as any).value,
      (newVal) => {
        try {
          const out = rebuildAllTasksList(newVal || {});
          try {
            flatTasks.value = out;
          } catch (e) {
            // ignore
          }
          if (typeof onUpdate === 'function') onUpdate(out);
        } catch (e) {
          // ignore
        }
      },
      { deep: true, immediate: false },
    );
    return stop;
  } catch (e) {
    return () => {};
  }
};

export const getTasksByCategory = (
  organiserData: OrganiserData,
  category: Task['category'],
): Task[] => {
  const tasks: Task[] = [];
  Object.values(organiserData.days).forEach((day) => {
    tasks.push(...day.tasks.filter((t) => t.category === category));
  });
  return tasks;
};

export const getTasksByPriority = (
  organiserData: OrganiserData,
  priority: Task['priority'],
): Task[] => {
  const tasks: Task[] = [];
  Object.values(organiserData.days).forEach((day) => {
    tasks.push(...day.tasks.filter((t) => t.priority === priority));
  });
  return tasks;
};

export const getIncompleteTasks = (organiserData: OrganiserData): Task[] => {
  const tasks: Task[] = [];
  Object.values(organiserData.days).forEach((day) => {
    tasks.push(...day.tasks.filter((t) => Number((t as any).status_id) !== 0));
  });
  return tasks.sort((a, b) => a.date.localeCompare(b.date));
};

// default days getter can be configured by callers that have access to the
// time API. By default it returns an empty map so unbound usages remain safe.
let _defaultDaysGetter: () => Record<string, any> = () => ({});

export const setDefaultDaysGetter = (g: () => Record<string, any>) => {
  if (typeof g === 'function') _defaultDaysGetter = g;
};

// Convenience wrappers that use the configured default days getter so callers
// can call taskService methods without passing an organiserData object.
const _getOrganiser = () => ({ days: _defaultDaysGetter() }) as any;

export const add = (date: string, taskData: any) => addTask(_getOrganiser(), date, taskData);
export const update = (date: string, id: string, updates: any) =>
  updateTask(_getOrganiser(), date, id, updates);
export const remove = (date: string, id: string) => deleteTask(_getOrganiser(), date, id);
export const toggleCompleteDefault = (date: string, id: string) =>
  toggleTaskComplete(_getOrganiser(), date, id);
export const undoCycleDoneDefault = (date: string, id: string) =>
  undoCycleDone(_getOrganiser(), date, id);
export const getAll = () => getAllTasks(_getOrganiser());
export const getInRange = (start: string, end: string) =>
  getTasksInRange(_getOrganiser(), start, end);
export const getByCategory = (category: Task['category']) =>
  getTasksByCategory(_getOrganiser(), category);
export const getByPriority = (priority: Task['priority']) =>
  getTasksByPriority(_getOrganiser(), priority);
export const getIncomplete = () => getIncompleteTasks(_getOrganiser());
