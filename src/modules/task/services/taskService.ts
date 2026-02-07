import { getCycleType } from '../utlils/occursOnDay';
import { ref } from 'vue';
import type { Ref } from 'vue';
import * as SubtaskLineService from './subtaskLine/subtaskLineService';
import type { ApiTask } from '../_apiTask';
import type { Task } from '../types';

export class TaskManager {
  apiTask: ApiTask | undefined;
  services: { subtaskLine: ReturnType<typeof SubtaskLineService.construct> };

  constructor(apiTask?: ApiTask) {
    try {
      this.apiTask = apiTask;
      setTimeApi(apiTask?.timeApi);
    } catch (e) {
      // ignore
    }
    this.services = {
      subtaskLine: SubtaskLineService.construct(this),
    };
  }

  addTask = (date: string, data: any) => addTask(date, data);
  updateTask = (date: string, taskOrId: Task | string, maybeUpdates?: any) =>
    updateTask(date, taskOrId as any, maybeUpdates, this.apiTask?.timeApi);
  deleteTask = (date: string, id: string) => deleteTask(date, id);
  toggleTaskComplete = (date: string, id: string) => toggleTaskComplete(date, id);
  undoCycleDone = (date: string, id: string) => undoCycleDone(date, id);
  getAll = () => getAll(this.apiTask?.timeApi);
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

  if (!getDays()[date]) {
    getDays()[date] = { date, tasks: [], notes: '' } as any;
  }
  getDays()[date].tasks.push(task);
  try {
    flatTasks.value.push(task);
    flatTasks.value.sort(
      (a, b) => a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority),
    );
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
  if (!day || !Array.isArray(day.tasks)) throw new Error('Task not found in provided day');
  let idx = day.tasks.findIndex((t: any) => t === taskObj);
  if (idx === -1) idx = day.tasks.findIndex((t: any) => String(t.id) === String(taskObj.id));
  if (idx === -1) throw new Error('Task not found in provided day');

  const existing = day.tasks[idx];
  try {
    if (existing) {
      Object.assign(existing, taskObj, { updatedAt: new Date().toISOString() });
      try {
        const fi = flatTasks.value.findIndex((t: any) => String(t.id) === String(existing.id));
        if (fi !== -1) {
          flatTasks.value[fi] = existing;
          flatTasks.value.sort(
            (a, b) => a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority),
          );
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
      flatTasks.value = flatTasks.value.filter((t) => String(t.id) !== String(taskId));
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
  if (!activeTaskRef || !activeModeRef) return;
  try {
    if (!payload) {
      activeTaskRef.value = null;
      activeModeRef.value = 'add';
      return;
    }
    if (typeof payload === 'string' || typeof payload === 'number') {
      const id = String(payload);
      const found = flatTasks.value.find((t) => String(t.id) === id);
      if (found) {
        activeTaskRef.value = found;
        activeModeRef.value = 'edit';
      } else {
        activeTaskRef.value = null;
        activeModeRef.value = 'add';
      }
      return;
    }
    // payload is a Task
    const task = payload;
    if (!task.id) {
      task.id = generateId();
    }
    activeTaskRef.value = task;
    activeModeRef.value = 'edit';
  } catch (e) {
    // ignore
  }
};
