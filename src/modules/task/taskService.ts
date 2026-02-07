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
export const construct = (timeApi?: any) => {
  try {
    setTimeApi(timeApi);
  } catch (e) {
    // ignore
  }

  return {
    addTask: (date: string, data: any) => addTask(date, data),
    updateTask: (date: string, taskOrId: Task | string, maybeUpdates?: any) => {
      if (typeof taskOrId === 'string') {
        const id = taskOrId;
        const updates = maybeUpdates || {};
        const existing = getAll(timeApi).find((t) => String(t.id) === String(id));
        if (!existing) throw new Error('Task not found');
        const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        return updateTask(date, merged as Task);
      }
      return updateTask(date, taskOrId);
    },
    deleteTask: (date: string, id: string) => deleteTask(date, id),
    toggleTaskComplete: (date: string, id: string) => toggleTaskComplete(date, id),
    undoCycleDone: (date: string, id: string) => undoCycleDone(date, id),
    subtaskLine: {
      toggleStatus: async (task: any, lineIndex: number) => {
        try {
          if (typeof lineIndex !== 'number' || !task || typeof task.description !== 'string')
            return null;
          const isCyclic = Boolean(getCycleType(task));
          const targetDate = !isCyclic
            ? task.date ||
              task.eventDate ||
              (timeApi && timeApi.currentDate ? timeApi.currentDate.value : '')
            : timeApi && timeApi.currentDate
              ? timeApi.currentDate.value
              : '';

          const lines = (task.description || '').split(/\r?\n/);
          let appendedIndex: number | undefined = undefined;
          const ln = lines[lineIndex] ?? '';
          const dashMatch = ln.match(/^(\s*-\s*)(\[[xX]\]\s*)?(.*)$/);
          const numMatch = ln.match(/^(\s*\d+[.)]\s*)(\[[xX]\]\s*)?(.*)$/);

          if (dashMatch) {
            const prefix = dashMatch[1];
            const marker = dashMatch[2] || '';
            const content = dashMatch[3] || '';
            const checked = /^\s*\[[xX]\]\s*/.test(marker);
            const hasTitleInDesc = Boolean(lines[0] && lines[0].trim() !== '');
            const baseInsertIndex = hasTitleInDesc ? 1 : 0;
            const hadStar = /\s*\*\s*$/.test(content);
            if (checked) {
              if (lineIndex === 0 && hasTitleInDesc) {
                lines[lineIndex] = `${prefix}${content}`;
              } else {
                const completedStart = lines.findIndex(
                  (ln2: string) =>
                    /^\s*-\s*\[[xX]\]/.test(ln2) || /^\s*\d+[.)]\s*\[[xX]\]/.test(ln2),
                );
                const undoneEnd = completedStart === -1 ? lines.length : completedStart;
                let lastStarIndex = -1;
                for (let i = baseInsertIndex; i < undoneEnd; i++) {
                  try {
                    if (/\*\s*$/.test(lines[i])) lastStarIndex = i;
                  } catch (e) {
                    // ignore
                  }
                }
                let finalInsert = baseInsertIndex;
                if (!hadStar && lastStarIndex !== -1) finalInsert = lastStarIndex + 1;
                const adjustedFinal = finalInsert > lineIndex ? finalInsert - 1 : finalInsert;
                if (lineIndex === adjustedFinal) {
                  lines[lineIndex] = `${prefix}${content}`;
                } else {
                  const movedLine = `${prefix}${content}`;
                  lines.splice(lineIndex, 1);
                  lines.splice(adjustedFinal, 0, movedLine);
                  appendedIndex = adjustedFinal;
                }
              }
            } else {
              const cleanContent = content.replace(/\s*\*\s*$/, '');
              const completedLine = `${prefix}[x] ${cleanContent}${hadStar ? ' *' : ''}`;
              lines.splice(lineIndex, 1);
              if (hadStar) {
                const completedStart = lines.findIndex(
                  (ln2: string) =>
                    /^(\s*-\s*\[[xX]\]\s*)/.test(ln2) || /^(\s*\d+[.)]\s*\[[xX]\]\s*)/.test(ln2),
                );
                if (completedStart === -1) {
                  lines.push(completedLine);
                  appendedIndex = lines.length - 1;
                } else {
                  lines.splice(completedStart, 0, completedLine);
                  appendedIndex = completedStart;
                }
              } else {
                lines.push(completedLine);
                appendedIndex = lines.length - 1;
              }
            }
          } else if (numMatch) {
            const prefix = numMatch[1];
            const marker = numMatch[2] || '';
            const content = numMatch[3] || '';
            const checked = /^\s*\[[xX]\]\s*/.test(marker);
            const hasTitleInDesc = Boolean(lines[0] && lines[0].trim() !== '');
            const baseInsertIndex = hasTitleInDesc ? 1 : 0;
            const hadStar = /\s*\*\s*$/.test(content);
            if (checked) {
              if (lineIndex === 0 && hasTitleInDesc) {
                lines[lineIndex] = `${prefix}${content}`;
              } else {
                const completedStart = lines.findIndex(
                  (ln2: string) =>
                    /^\s*-\s*\[[xX]\]/.test(ln2) || /^\s*\d+[.)]\s*\[[xX]\]/.test(ln2),
                );
                const undoneEnd = completedStart === -1 ? lines.length : completedStart;
                let lastStarIndex = -1;
                for (let i = baseInsertIndex; i < undoneEnd; i++) {
                  try {
                    if (/\*\s*$/.test(lines[i])) lastStarIndex = i;
                  } catch (e) {
                    // ignore
                  }
                }
                let finalInsert = baseInsertIndex;
                if (!hadStar && lastStarIndex !== -1) finalInsert = lastStarIndex + 1;
                const adjustedIndex = finalInsert > lineIndex ? finalInsert - 1 : finalInsert;
                if (lineIndex === adjustedIndex) {
                  lines[lineIndex] = `${prefix}${content}`;
                } else {
                  const movedLine = `${prefix}${content}`;
                  lines.splice(lineIndex, 1);
                  lines.splice(adjustedIndex, 0, movedLine);
                  appendedIndex = adjustedIndex;
                }
              }
            } else {
              const hadStarLocal = /\s*\*\s*$/.test(content);
              const cleanContent = content.replace(/\s*\*\s*$/, '');
              const completedLine = `- [x] ${cleanContent}${hadStarLocal ? ' *' : ''}`;
              lines.splice(lineIndex, 1);
              if (hadStarLocal) {
                const completedStart = lines.findIndex(
                  (ln2: string) =>
                    /^(\s*-\s*\[[xX]\]\s*)/.test(ln2) || /^(\s*\d+[.)]\s*\[[xX]\]\s*)/.test(ln2),
                );
                if (completedStart === -1) {
                  lines.push(completedLine);
                  appendedIndex = lines.length - 1;
                } else {
                  lines.splice(completedStart, 0, completedLine);
                  appendedIndex = completedStart;
                }
              } else {
                lines.push(completedLine);
                appendedIndex = lines.length - 1;
              }
            }
          } else {
            return null;
          }

          const newDesc = lines.join('\n');
          try {
            const merged: any = {
              ...task,
              description: newDesc,
              updatedAt: new Date().toISOString(),
            };
            updateTask(targetDate, merged as Task);
          } catch (e) {
            // ignore update failures
          }
          return { newDesc, appendedIndex };
        } catch (e) {
          return null;
        }
      },
      add: async (task: any, text: string) => {
        try {
          if (!task || typeof text !== 'string' || !text.trim()) return null;
          const cur = task.description || '';
          const lines = cur.split(/\r?\n/);
          // find last starred undone list item
          let lastStarredUndone = -1;
          for (let i = 0; i < lines.length; i++) {
            try {
              const ln = lines[i] || '';
              const dashMatch = ln.match(/^\s*-\s*(.*)$/);
              if (!dashMatch) continue;
              const content = dashMatch[1] || '';
              const checked = /^\s*\[[xX]\]/.test(content);
              const starred = /\*\s*$/.test(content);
              if (starred && !checked) lastStarredUndone = i;
            } catch (e) {
              // ignore
            }
          }

          let updated: string;
          if (lastStarredUndone >= 0) {
            const newLines = [...lines];
            newLines.splice(lastStarredUndone + 1, 0, `- ${text}`);
            updated = newLines.join('\n');
          } else {
            const title = (task.name || '').trim();
            if (title && lines.length > 0) {
              const first = lines[0] || '';
              const firstNorm = first.trim().toLowerCase();
              const titleNorm = title.toLowerCase();
              if (firstNorm.startsWith(titleNorm)) {
                if (lines.length === 1) {
                  updated = `${first}\n- ${text}`;
                } else {
                  updated = `${first}\n- ${text}\n${lines.slice(1).join('\n')}`;
                }
              } else {
                updated = cur ? `- ${text}\n${cur}` : `- ${text}`;
              }
            } else {
              updated = cur ? `- ${text}\n${cur}` : `- ${text}`;
            }
          }

          const isCyclic = Boolean(getCycleType(task));
          const targetDate = !isCyclic
            ? task.date ||
              task.eventDate ||
              (timeApi && timeApi.currentDate ? timeApi.currentDate.value : '')
            : timeApi && timeApi.currentDate
              ? timeApi.currentDate.value
              : '';

          try {
            const merged: any = {
              ...task,
              description: updated,
              updatedAt: new Date().toISOString(),
            };
            updateTask(targetDate, merged as Task);
          } catch (e) {
            // ignore
          }
          return { newDesc: updated };
        } catch (e) {
          return null;
        }
      },
    },
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
            // Only change the current date for time-based or cyclic tasks. Selecting
            // a plain Todo should not move the calendar day.
            const isCyclic = Boolean(getCycleType(found));
            const isTimeEvent =
              Boolean((found as any).eventTime) || (found as any).type_id === 'TimeEvent';
            if (isCyclic || isTimeEvent) {
              const newDate = (found as any).date || (found as any).eventDate || null;
              try {
                const currentDate =
                  timeApi && typeof timeApi.currentDate !== 'undefined'
                    ? timeApi.currentDate
                    : undefined;
                if (currentDate !== newDate) timeApi.setCurrentDate(newDate);
              } catch (e) {
                timeApi.setCurrentDate(newDate);
              }
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
        if (timeApi && typeof timeApi.setCurrentDate === 'function') {
          const isCyclic = Boolean(getCycleType(found));
          const isTimeEvent =
            Boolean((found as any).eventTime) || (found as any).type_id === 'TimeEvent';
          if (isCyclic || isTimeEvent) {
            timeApi.setCurrentDate((found as any).date || (found as any).eventDate || null);
          }
        }
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
