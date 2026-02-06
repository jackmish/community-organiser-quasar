import { getCycleType } from './utlils/occursOnDay';
import { watch, ref } from 'vue';
import type { Ref } from 'vue';
import type { Task } from './types';

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// (No module-level flat list here) task lists are built from organiser data on demand.

// Reactive flat list exposed for callers that want to observe all tasks.
export const flatTasks = ref<Task[]>([]);

type DaysMap = Record<string, any>;

// Module-level days map/ref; can be initialized by passing a `time` API via `setTimeApi`.
let daysMap: DaysMap = {} as DaysMap;
let daysRef: Ref<any> | undefined;

const getDays = () => {
  try {
    return (daysRef && (daysRef as any).value) || daysMap || {};
  } catch (e) {
    return daysMap || {};
  }
};

export const setTimeApi = (t: any) => {
  try {
    daysRef = t && t.days ? t.days : undefined;
    daysMap = t && t.days ? t.days.value : {};
  } catch (e) {
    daysMap = {} as DaysMap;
  }
};

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

  if (!daysMap[date]) {
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

export const updateTask = (date: string, taskObj: Task): void => {
  // Minimal/dumb updater: only operate within the provided date bucket.
  const day = getDays()[date];
  if (!day || !Array.isArray(day.tasks)) throw new Error('Task not found in provided day');
  // Prefer identity match; if not found, try matching by id inside the same day.
  let idx = day.tasks.findIndex((t: any) => t === taskObj);
  if (idx === -1) idx = day.tasks.findIndex((t: any) => String(t.id) === String(taskObj.id));
  if (idx === -1) throw new Error('Task not found in provided day');

  const existing = day.tasks[idx];
  try {
    // Merge provided task object's fields into the existing task and update timestamp
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
  // update flatTasks cache
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
  // no module-level cache update here
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

// Prefer cached `flatTasks` when available, otherwise build from a provided
// `timeApi.days` or fall back to `getAllTasks()`.
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

// Factory that binds a `timeApi` to a simple service object. It sets the
// module-level days map (via `setTimeApi`) for compatibility, then returns
// wrappers that operate using the provided `timeApi` where appropriate.
export const createTaskService = (timeApi?: any) => {
  try {
    setTimeApi(timeApi);
  } catch (e) {
    // ignore
  }

  return {
    addTask: (date: string, data: any) => addTask(date, data),
    updateTask: (date: string, task: Task) => updateTask(date, task),
    deleteTask: (date: string, id: string) => deleteTask(date, id),
    toggleTaskComplete: (date: string, id: string) => toggleTaskComplete(date, id),
    undoCycleDone: (date: string, id: string) => undoCycleDone(date, id),
    getAll: () => getAll(timeApi),
    getTasksInRange: (s: string, e: string) => getTasksInRange(s, e),
    getTasksByCategory: (c: Task['category']) => getTasksByCategory(c),
    getTasksByPriority: (p: Task['priority']) => getTasksByPriority(p),
    getIncompleteTasks: () => getIncompleteTasks(),
    buildFlatTasksList: (daysArg?: Record<string, any>) => buildFlatTasksList(daysArg),
    flatTasks,
    applyActiveSelection: (
      activeTaskRef: Ref<Task | null>,
      activeModeRef: Ref<'add' | 'edit' | 'preview'>,
      payload: string | number | Task | null,
    ) =>
      applyActiveSelection(
        activeTaskRef,
        activeModeRef,
        timeApi /* bound at factory time */,
        payload as any,
      ),
  } as const;
};

// Build a sorted flat list from a days map WITHOUT mutating the module-level
// `flatTasks` reactive cache. Use this when callers need a snapshot for
// rendering and should not trigger side-effects.
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

export const buildFlatTasksList = (daysArg?: Record<string, any>): Task[] => {
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
      // If the same task is already selected in preview mode, avoid re-assigning
      // to prevent reactive loops. Still update the current date only when it
      // actually differs.
      const currentlySelectedId =
        activeTaskRef.value && (activeTaskRef.value as any).id
          ? String((activeTaskRef.value as any).id)
          : null;
      const foundId = (found as any).id ? String((found as any).id) : null;
      if (
        currentlySelectedId &&
        foundId &&
        currentlySelectedId === foundId &&
        activeModeRef.value === 'preview'
      ) {
        try {
          if (timeApi && typeof timeApi.setCurrentDate === 'function') {
            const newDate = (found as any).date || (found as any).eventDate || null;
            // Only set if different to avoid triggering time watchers unnecessarily
            try {
              const currentDate =
                timeApi && typeof timeApi.currentDate !== 'undefined'
                  ? timeApi.currentDate
                  : undefined;
              if (currentDate !== newDate) timeApi.setCurrentDate(newDate);
            } catch (e) {
              // best-effort: call setCurrentDate if we cannot read currentDate
              timeApi.setCurrentDate(newDate);
            }
          }
        } catch (e) {
          // ignore
        }
        return;
      }

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
      const initial = buildFlatTasksList((daysRef as any).value || {});
      if (typeof onUpdate === 'function') onUpdate(initial);
    } catch (e) {
      // ignore
    }
    const stop = watch(
      () => (daysRef as any).value,
      (newVal) => {
        try {
          const out = buildFlatTasksList(newVal || {});
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

export const getTasksByCategory = (category: Task['category']): Task[] => {
  const days = getDays();
  const tasks: Task[] = [];
  Object.values(days).forEach((day: any) => {
    tasks.push(...(day.tasks || []).filter((t: Task) => t.category === category));
  });
  return tasks;
};

export const getTasksByPriority = (priority: Task['priority']): Task[] => {
  const days = getDays();
  const tasks: Task[] = [];
  Object.values(days).forEach((day: any) => {
    tasks.push(...(day.tasks || []).filter((t: Task) => t.priority === priority));
  });
  return tasks;
};

export const getIncompleteTasks = (): Task[] => {
  const days = getDays();
  const tasks: Task[] = [];
  Object.values(days).forEach((day: any) => {
    tasks.push(...(day.tasks || []).filter((t: Task) => Number((t as any).status_id) !== 0));
  });
  return tasks.sort((a, b) => a.date.localeCompare(b.date));
};

// Convenience aliases removed — callers should use the exported core functions
// (e.g. `addTask`, `updateTask`, `deleteTask`, `getAllTasks`) or use the
// `api.task` facade which delegates to this service. This keeps the module
// free of implicit runtime wiring and ensures a single explicit source of
// truth: `time.days`.
