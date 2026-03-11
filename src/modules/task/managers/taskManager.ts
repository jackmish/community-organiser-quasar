import { getCycleType, occursOnDay } from '../utlils/occursOnDay';
import { ref } from 'vue';
import type { Ref } from 'vue';
import * as SubtaskLineManager from './subtaskLine/subtaskLineManager';
import type { ApiTask } from '../_apiTask';
import { Task } from '../types';

export class TaskManager {
  apiTask: ApiTask | undefined;
  managers: { subtaskLine: ReturnType<typeof SubtaskLineManager.construct> };

  constructor(apiTask?: ApiTask) {
    try {
      this.apiTask = apiTask;
      setTimeApi(apiTask?.time);
    } catch (e) {
      // ignore
    }
    this.managers = {
      subtaskLine: SubtaskLineManager.construct(this),
    };
  }

  addTask = (date: string, data: any) => addTask(date, data);
  updateTask = (date: string, taskOrId: Task | string, maybeUpdates?: any) =>
    updateTask(date, taskOrId as any, maybeUpdates, this.apiTask?.time);
  deleteTask = (date: string, id: string) => deleteTask(date, id);
  toggleTaskComplete = (date: string, id: string) => toggleTaskComplete(date, id);
  undoCycleDone = (date: string, id: string) => undoCycleDone(date, id);
  getAll = () => getAll(this.apiTask?.time);
  getTasksForDay = (date: string): Task[] => {
    try {
      const day = String(date || '');
      const dayTasks = (
        getDays()[day] && Array.isArray(getDays()[day].tasks) ? getDays()[day].tasks.slice() : []
      ) as Task[];
      const all = getAll(this.apiTask?.time) || [];
      const result: Task[] = [...dayTasks];
      for (const t of all) {
        try {
          if (Number(t.status_id) === 0) continue;
          if (t.type_id === 'Replenish') continue;
          if (occursOnDay(t, day)) {
            if (!result.some((existing) => String(existing.id) === String(t.id))) {
              const clone: any = { ...t, eventDate: day };
              clone.__isCyclicInstance = true;
              result.push(clone as Task);
            }
          }
        } catch (e) {
          // ignore per-task failures
        }
      }
      result.sort((a, b) => {
        const hasTimeA = !!a.eventTime;
        const hasTimeB = !!b.eventTime;
        if (hasTimeA && !hasTimeB) return -1;
        if (!hasTimeA && hasTimeB) return 1;
        if (hasTimeA && hasTimeB) return (a.eventTime || '').localeCompare(b.eventTime || '');
        const priorityOrder: Record<string, number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        const priorityCompare =
          (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
        if (priorityCompare !== 0) return priorityCompare;
        return 0;
      });
      return result;
    } catch (e) {
      return [];
    }
  };
  getTasksInRange = (s: string, e: string) => getTasksInRange(s, e);
  getTasksByCategory = (c: Task['category']) => getTasksByCategory(c);
  getTasksByPriority = (p: Task['priority']) => getTasksByPriority(p);
  getIncompleteTasks = () => getIncompleteTasks();
  buildFlatTasksList = (daysArg?: Record<string, any>) => listFromDays(daysArg);
  get flatTasks() {
    return flatTasks;
  }
  applyActiveSelection = (
    activeTaskRef: Ref<Task | null>,
    activeModeRef: Ref<'add' | 'edit' | 'preview'>,
    payload: string | number | Task | null,
  ) => applyActiveSelection(activeTaskRef, activeModeRef, payload as any);
}

// Backwards-compatible alias: prefer `TaskManager`, keep `TaskService` for callers
export { TaskManager as TaskService };

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const flatTasks = ref<Task[]>([]);

type DaysMap = Record<string, any>;

let daysMap: DaysMap = {} as DaysMap;
let daysRef: Ref<any> | undefined;
let currentTimeApi: any = undefined;

const getDays = () => {
  try {
    return (daysRef && (daysRef as any).value) || daysMap || {};
  } catch (e) {
    return daysMap || {};
  }
};

export const setTimeApi = (t: any) => {
  try {
    currentTimeApi = t;
    daysRef = t && t.days ? t.days : undefined;
    daysMap = t && t.days ? t.days.value : {};
  } catch (e) {
    daysMap = {} as DaysMap;
  }
};

export const addTask = (
  date: string,
  taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
): Task => {
  const now = new Date().toISOString();
  const payload: Partial<Task> = {
    ...taskData,
    createdAt: now,
    updatedAt: now,
  };
  const task: Task = new Task({ ...(payload as any), id: generateId() });

  try {
    const isCyclic = Boolean(getCycleType(task));
    if (isCyclic) {
      (task as any).status_id = 1;
    }
  } catch (e) {
    // ignore
  }

  if (!getDays()[date]) {
    getDays()[date] = { date, tasks: [], notes: '' } as any;
  }
  getDays()[date].tasks.push(task as any);
  try {
    // Rebuild flatTasks from days to keep list consistent and avoid duplicates
    const newList = listFromDays(getDays());
    flatTasks.value.splice(0, flatTasks.value.length, ...newList);
  } catch (e) {
    // ignore
  }
  return task;
};

export const updateTask = (
  date: string,
  taskOrId: Task | string,
  maybeUpdates?: any,
  timeApi?: any,
): void => {
  let taskObj: Task;
  if (typeof taskOrId === 'string') {
    const id = taskOrId;
    const updates = maybeUpdates || {};
    const existing = getAll(timeApi).find((t) => String(t.id) === String(id));
    if (!existing) throw new Error('Task not found');
    taskObj = { ...existing, ...updates, updatedAt: new Date().toISOString() } as Task;
  } else {
    taskObj = taskOrId;
  }

  const day = getDays()[date];
  // Ensure the task object reflects the target date so date/eventDate updates persist
  try {
    (taskObj as any).date = date;
    (taskObj as any).eventDate = date;
  } catch (e) {
    // ignore
  }
  // ensure target day exists
  if (!getDays()[date]) getDays()[date] = { date, tasks: [], notes: '' } as any;
  const targetDay = getDays()[date];

  let idx = (targetDay.tasks || []).findIndex((t: any) => t === taskObj);
  if (idx === -1)
    idx = (targetDay.tasks || []).findIndex((t: any) => String(t.id) === String(taskObj.id));

  // If task not present in the target day, try to find it in other days
  // and move it into the target day (handles date changes).
  if (idx === -1) {
    let found = false;
    for (const key of Object.keys(getDays())) {
      const d = getDays()[key];
      if (!d || !Array.isArray(d.tasks)) continue;
      const fi = d.tasks.findIndex((t: any) => String(t.id) === String(taskObj.id));
      if (fi !== -1) {
        const existing = d.tasks[fi];
        // remove from old day
        d.tasks.splice(fi, 1);
        // ensure target day tasks array exists
        if (!Array.isArray(targetDay.tasks)) targetDay.tasks = [];
        // push existing (merged with updates/taskObj) into target day
        const mergedPayload: Partial<Task> = {
          ...existing,
          ...taskObj,
          date: date,
          eventDate: date,
          updatedAt: new Date().toISOString(),
        };
        const merged = new Task(mergedPayload);
        targetDay.tasks.push(merged);
        taskObj = merged;
        idx = targetDay.tasks.length - 1;
        found = true;
        break;
      }
    }
    if (!found) throw new Error('Task not found in provided day');
  }
  const existing = targetDay.tasks[idx];
  try {
    if (existing) {
      Object.assign(existing, taskObj, { updatedAt: new Date().toISOString() });
      try {
        // Rebuild the flat tasks list from current days so any moves/field
        // updates (date/type/etc.) are reflected consistently in the UI.
        const newList = listFromDays(getDays());
        flatTasks.value.splice(0, flatTasks.value.length, ...newList);
        // Ensure the updated task object replaces any stale entry in flatTasks
        try {
          const fi = flatTasks.value.findIndex((t: any) => String(t.id) === String(taskObj.id));
          if (fi !== -1) {
            flatTasks.value[fi] = existing;
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore merge failures
  }
};

export const deleteTask = (date: string, taskId: string): boolean => {
  let removed = false;
  try {
    const dayData = getDays()[date];
    if (dayData && Array.isArray(dayData.tasks)) {
      const before = dayData.tasks.length;
      dayData.tasks = dayData.tasks.filter((t: any) => String(t.id) !== String(taskId));
      if (dayData.tasks.length < before) removed = true;
    }
  } catch (e) {
    // continue to global search
  }

  try {
    for (const dKey of Object.keys(getDays())) {
      const d = getDays()[dKey];
      if (!d || !Array.isArray(d.tasks)) continue;
      const before = d.tasks.length;
      d.tasks = d.tasks.filter((t: any) => String(t.id) !== String(taskId));
      if (d.tasks.length < before) removed = true;
    }
  } catch (err) {
    // ignore
  }

  try {
    if (removed) {
      for (let i = flatTasks.value.length - 1; i >= 0; i--) {
        if (String(flatTasks.value[i]?.id) === String(taskId)) flatTasks.value.splice(i, 1);
      }
    }
  } catch (e) {
    // ignore
  }
  return removed;
};

export const toggleTaskComplete = (date: string, taskId: string): void => {
  const dayData = getDays()[date];
  let task = dayData?.tasks?.find((t: any) => t.id === taskId);

  if (!task) {
    for (const dKey of Object.keys(getDays())) {
      const d = getDays()[dKey];
      if (!d || !Array.isArray(d.tasks)) continue;
      const found = d.tasks.find((t: any) => t.id === taskId);
      if (found) {
        task = found;
        break;
      }
    }
  }

  if (!task) return;

  try {
    const cur = Number(task.status_id);
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
      task.status_id = next;
    }
  } catch (e) {
    task.status_id = 1;
  }
  task.updatedAt = new Date().toISOString();
  try {
    const fi = flatTasks.value.findIndex((t: any) => String(t.id) === String(task.id));
    if (fi !== -1) {
      flatTasks.value[fi] = task;
    }
  } catch (e) {
    // ignore
  }
};

export const undoCycleDone = (date: string, taskId: string): boolean => {
  try {
    for (const dayKey of Object.keys(getDays())) {
      const day = getDays()[dayKey];
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
          try {
            const fi = flatTasks.value.findIndex((t: any) => String(t.id) === String(task.id));
            if (fi !== -1) flatTasks.value[fi] = task;
          } catch (e) {
            // ignore
          }
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

export const getTasksInRange = (startDate: string, endDate: string): Task[] => {
  const tasks: Task[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  Object.keys(getDays()).forEach((date) => {
    const current = new Date(date);
    if (current >= start && current <= end) {
      const dayTasks = getDays()[date]?.tasks;
      if (dayTasks) tasks.push(...dayTasks);
    }
  });
  return tasks.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.priority.localeCompare(b.priority);
  });
};

export const getAllTasks = (): Task[] => {
  const tasks: Task[] = [];
  try {
    Object.keys(getDays()).forEach((date) => {
      const dayTasks = getDays()[date]?.tasks;
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

export const listFromDays = (daysArg?: Record<string, any>): Task[] => {
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
  return out.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.priority.localeCompare(b.priority);
  });
};

export const getAll = (timeApi?: any): Task[] => {
  try {
    const maybe = (flatTasks as any).value;
    if (Array.isArray(maybe) && maybe.length > 0) return maybe as Task[];
  } catch (e) {
    // ignore
  }
  if (timeApi && timeApi.days) return listFromDays(timeApi.days.value || {});
  return getAllTasks();
};

export const getTasksByCategory = (c: Task['category']): Task[] => {
  return getAll().filter((t) => t.category === c);
};

export const getTasksByPriority = (p: Task['priority']): Task[] => {
  return getAll().filter((t) => t.priority === p);
};

export const getIncompleteTasks = (): Task[] => {
  return getAll().filter((t) => Number(t.status_id) === 0);
};

export const buildFlatTasksList = (daysArg?: Record<string, any>): Task[] => {
  return listFromDays(daysArg);
};

export const applyActiveSelection = (
  activeTaskRef: Ref<Task | null>,
  activeModeRef: Ref<'add' | 'edit' | 'preview'>,
  payload: string | number | Task | null,
) => {
  // applyActiveSelection called
  if (!activeTaskRef || !activeModeRef) return;
  try {
    // Treat only `null` or `undefined` as request to clear selection.
    // Avoid treating other falsy values (0, '') as clear requests so
    // callers that accidentally pass empty strings/numeric IDs aren't
    // interpreted as a reset.
    if (payload === null || payload === undefined) {
      // Log stack to help trace callers passing `null`/`undefined`

      activeTaskRef.value = null;
      activeModeRef.value = 'add';
      return;
    }
    if (typeof payload === 'string' || typeof payload === 'number') {
      const id = String(payload);
      // Prefer fast lookup in `flatTasks`, but fall back to full task lists
      // (derived from days/time API) when `flatTasks` is empty or doesn't
      // contain the requested item. This ensures callers that pass an id
      // (e.g. right-click handlers) will resolve the canonical task object
      // even when `flatTasks` wasn't populated yet.
      let found: Task | null = null;
      // looking for task id
      try {
        found = flatTasks.value.find((t) => String(t.id) === id) || null;
        // found in flatTasks
      } catch (e) {
        found = null;
      }
      if (!found) {
        try {
          const all = getAll(currentTimeApi) || [];
          found = (all || []).find((t) => String(t.id) === id) || null;
          // found in getAll()
        } catch (e) {
          found = null;
        }
      }
      // As a final fallback, scan the raw days map to find the canonical
      // task object. This covers cases where neither `flatTasks` nor the
      // derived `getAll()` list contains the item (e.g. timing/order issues
      // during initial load).
      if (!found) {
        try {
          const days = getDays() || {};
          for (const dKey of Object.keys(days)) {
            const d = days[dKey];
            if (!d || !Array.isArray(d.tasks)) continue;
            const f = d.tasks.find((t: any) => String(t.id) === id);
            if (f) {
              found = f || null;
              // found in days map
              break;
            }
          }
        } catch (e) {
          found = null;
        }
      }
      if (found) {
        activeTaskRef.value = found;
        activeModeRef.value = 'edit';
        // set active task
      } else {
        activeTaskRef.value = null;
        activeModeRef.value = 'add';
        // task not found, set to add
      }
      return;
    }
    // payload is a Task — clone instead of mutating the caller's object
    let taskObj = payload;
    if (!taskObj.id) {
      taskObj = { ...taskObj, id: generateId() } as Task;
    }
    activeTaskRef.value = taskObj;
    activeModeRef.value = 'edit';
  } catch (e) {
    // ignore
  }
};
