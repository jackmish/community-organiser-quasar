import { getCycleType, occursOnDay } from '../utils/occursOnDay';
import { ref } from 'vue';
import type { Ref } from 'vue';
import * as SubtaskLineRepository from './subtaskLine/subtaskLineRepository';
import { Task } from '../models/TaskModel';

/** Minimal shape that TaskRepository needs from the task store/API. */
export interface TaskTimeProvider {
  time?: any;
  /** Legacy: old task state bag; kept optional for sub-managers. */
  state?: any;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TaskRepository
//
// All state that was previously held as module-level mutable variables is now
// owned by each TaskRepository instance, making instances genuinely independent
// and unit-testable in isolation.
//
// A module-level singleton (`_singleton`) is created at the bottom and the
// previously exported free functions become thin delegates to it, so every
// existing call site continues to work without modification.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export class TaskRepository {
  // â”€â”€ Public fields (SubtaskLineRepository reads these) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  timeProvider: TaskTimeProvider | undefined;
  managers: { subtaskLine: ReturnType<typeof SubtaskLineRepository.construct> };

  // â”€â”€ Per-instance state (was module-level globals) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Reactive flat list of all tasks â€” mirrors `days` in sorted order. */
  readonly flatTasksRef = ref<Task[]>([]);

  private _daysMap: Record<string, any> = {};
  private _daysRef: Ref<any> | undefined = undefined;
  private _time: any = undefined;

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDays(): Record<string, any> {
    try {
      return (this._daysRef && (this._daysRef as any).value) || this._daysMap || {};
    } catch (e) {
      return this._daysMap || {};
    }
  }

  // â”€â”€ Constructor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  constructor(timeProvider?: TaskTimeProvider) {
    try {
      this.timeProvider = timeProvider;
      this.setTime(timeProvider?.time);
    } catch (e) {
      // ignore
    }
    this.managers = {
      subtaskLine: SubtaskLineRepository.construct(this),
    };
  }

  // â”€â”€ State initialisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setTime(t: any): void {
    try {
      this._time = t;
      this._daysRef = t && t.days ? t.days : undefined;
      this._daysMap = t && t.days ? t.days.value : {};
    } catch (e) {
      this._daysMap = {};
    }
  }

  // â”€â”€ Task mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addTask(date: string, taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const now = new Date().toISOString();
    const payload: Partial<Task> = { ...taskData, createdAt: now, updatedAt: now };
    const task: Task = new Task({ ...(payload as any), id: this.generateId() });

    try {
      const isCyclic = Boolean(getCycleType(task));
      if (isCyclic) (task as any).status_id = 1;
    } catch (e) {
      // ignore
    }

    if (!this.getDays()[date]) {
      this.getDays()[date] = { date, tasks: [], notes: '' } as any;
    }
    this.getDays()[date].tasks.push(task as any);

    try {
      const newList = this.listFromDays(this.getDays());
      this.flatTasksRef.value.splice(0, this.flatTasksRef.value.length, ...newList);
    } catch (e) {
      // ignore
    }
    return task;
  }

  updateTask(
    date: string,
    taskOrId: Task | string,
    maybeUpdates?: any,
    /** @deprecated pass via constructor; kept for backward-compat call sites */
    _timeApi?: any,
  ): void {
    let taskObj: Task;
    if (typeof taskOrId === 'string') {
      const id = taskOrId;
      const updates = maybeUpdates || {};
      const existing = this.getFlatList().find((t) => String(t.id) === String(id));
      if (!existing) throw new Error('Task not found');
      taskObj = { ...existing, ...updates, updatedAt: new Date().toISOString() } as Task;
    } else {
      taskObj = taskOrId;
    }

    try {
      (taskObj as any).date = date;
      (taskObj as any).eventDate = date;
    } catch (e) {
      // ignore
    }

    if (!this.getDays()[date]) this.getDays()[date] = { date, tasks: [], notes: '' } as any;
    const targetDay = this.getDays()[date];

    let idx = (targetDay.tasks || []).findIndex((t: any) => t === taskObj);
    if (idx === -1)
      idx = (targetDay.tasks || []).findIndex((t: any) => String(t.id) === String(taskObj.id));

    // If task not present in the target day, try to find it in other days
    // and move it into the target day (handles date changes).
    if (idx === -1) {
      let found = false;
      for (const key of Object.keys(this.getDays())) {
        const d = this.getDays()[key];
        if (!d || !Array.isArray(d.tasks)) continue;
        const fi = d.tasks.findIndex((t: any) => String(t.id) === String(taskObj.id));
        if (fi !== -1) {
          const existingRec = d.tasks[fi];
          d.tasks.splice(fi, 1);
          if (!Array.isArray(targetDay.tasks)) targetDay.tasks = [];
          const mergedPayload: Partial<Task> = {
            ...existingRec,
            ...taskObj,
            date,
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

    const existingRec = targetDay.tasks[idx];
    try {
      if (existingRec) {
        Object.assign(existingRec, taskObj, { updatedAt: new Date().toISOString() });
        try {
          // Rebuild the flat tasks list from current days so any moves/field
          // updates (date/type/etc.) are reflected consistently in the UI.
          const newList = this.listFromDays(this.getDays());
          this.flatTasksRef.value.splice(0, this.flatTasksRef.value.length, ...newList);
          try {
            const fi = this.flatTasksRef.value.findIndex(
              (t: any) => String(t.id) === String(taskObj.id),
            );
            if (fi !== -1) this.flatTasksRef.value[fi] = existingRec;
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
  }

  deleteTask(date: string, taskId: string): boolean {
    let removed = false;
    try {
      const dayData = this.getDays()[date];
      if (dayData && Array.isArray(dayData.tasks)) {
        const before = dayData.tasks.length;
        dayData.tasks = dayData.tasks.filter((t: any) => String(t.id) !== String(taskId));
        if (dayData.tasks.length < before) removed = true;
      }
    } catch (e) {
      // continue to global search
    }

    try {
      for (const dKey of Object.keys(this.getDays())) {
        const d = this.getDays()[dKey];
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
        for (let i = this.flatTasksRef.value.length - 1; i >= 0; i--) {
          if (String(this.flatTasksRef.value[i]?.id) === String(taskId))
            this.flatTasksRef.value.splice(i, 1);
        }
      }
    } catch (e) {
      // ignore
    }
    return removed;
  }

  toggleTaskComplete(date: string, taskId: string): void {
    const dayData = this.getDays()[date];
    let task = dayData?.tasks?.find((t: any) => t.id === taskId);

    if (!task) {
      for (const dKey of Object.keys(this.getDays())) {
        const d = this.getDays()[dKey];
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
      const fi = this.flatTasksRef.value.findIndex((t: any) => String(t.id) === String(task.id));
      if (fi !== -1) this.flatTasksRef.value[fi] = task;
    } catch (e) {
      // ignore
    }
  }

  undoCycleDone(date: string, taskId: string): boolean {
    try {
      for (const dayKey of Object.keys(this.getDays())) {
        const day = this.getDays()[dayKey];
        if (!day || !Array.isArray(day.tasks)) continue;
        const task = day.tasks.find((t: any) => t.id === taskId);
        if (task) {
          if (!Array.isArray(task.history)) return false;
          const before = task.history.length;
          task.history = task.history.filter(
            (h: any) => !(h && h.type === 'cycleDone' && h.date === date),
          );
          if (task.history.length < before) {
            task.updatedAt = new Date().toISOString();
            try {
              const fi = this.flatTasksRef.value.findIndex(
                (t: any) => String(t.id) === String(task.id),
              );
              if (fi !== -1) this.flatTasksRef.value[fi] = task;
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
  }

  // â”€â”€ Query methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  listFromDays(daysArg?: Record<string, any>): Task[] {
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
  }

  getAllTasks(): Task[] {
    const tasks: Task[] = [];
    try {
      Object.keys(this.getDays()).forEach((date) => {
        const dayTasks = this.getDays()[date]?.tasks;
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
  }

  getFlatList(time?: any): Task[] {
    try {
      const maybe = this.flatTasksRef.value;
      if (Array.isArray(maybe) && maybe.length > 0) return maybe;
    } catch (e) {
      // ignore
    }
    const resolvedApi = time ?? this._time;
    if (resolvedApi && resolvedApi.days) return this.listFromDays(resolvedApi.days.value || {});
    return this.getAllTasks();
  }

  getTasksInRange(startDate: string, endDate: string): Task[] {
    const tasks: Task[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    Object.keys(this.getDays()).forEach((date) => {
      const current = new Date(date);
      if (current >= start && current <= end) {
        const dayTasks = this.getDays()[date]?.tasks;
        if (dayTasks) tasks.push(...dayTasks);
      }
    });
    return tasks.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.priority.localeCompare(b.priority);
    });
  }

  getTasksForDay(date: string): Task[] {
    try {
      const day = String(date || '');
      const dayTasks = (
        this.getDays()[day] && Array.isArray(this.getDays()[day].tasks)
          ? this.getDays()[day].tasks.slice()
          : []
      ) as Task[];
      const all = this.getFlatList() || [];
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
  }

  getTasksByCategory(c: Task['category']): Task[] {
    return this.getFlatList().filter((t) => t.category === c);
  }

  getTasksByPriority(p: Task['priority']): Task[] {
    return this.getFlatList().filter((t) => t.priority === p);
  }

  getIncompleteTasks(): Task[] {
    return this.getFlatList().filter((t) => Number(t.status_id) === 0);
  }

  buildFlatTasksList(daysArg?: Record<string, any>): Task[] {
    return this.listFromDays(daysArg);
  }

  applyActiveSelection(
    activeTaskRef: Ref<Task | null>,
    activeModeRef: Ref<'add' | 'edit' | 'preview'>,
    payload: string | number | Task | null,
  ): void {
    if (!activeTaskRef || !activeModeRef) return;
    try {
      if (payload === null || payload === undefined) {
        activeTaskRef.value = null;
        activeModeRef.value = 'add';
        return;
      }
      if (typeof payload === 'string' || typeof payload === 'number') {
        const id = String(payload);
        let found: Task | null = null;

        try {
          found = this.flatTasksRef.value.find((t) => String(t.id) === id) || null;
        } catch (e) {
          found = null;
        }

        if (!found) {
          try {
            found = (this.getFlatList(this._time) || []).find((t) => String(t.id) === id) || null;
          } catch (e) {
            found = null;
          }
        }

        // Final fallback: scan the raw days map
        if (!found) {
          try {
            const days = this.getDays() || {};
            for (const dKey of Object.keys(days)) {
              const d = days[dKey];
              if (!d || !Array.isArray(d.tasks)) continue;
              const f = d.tasks.find((t: any) => String(t.id) === id);
              if (f) {
                found = f || null;
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
        } else {
          activeTaskRef.value = null;
          activeModeRef.value = 'add';
        }
        return;
      }

      // payload is a Task object â€” use as-is (generate id if missing)
      let taskObj = payload;
      if (!taskObj.id) taskObj = { ...taskObj, id: this.generateId() } as Task;
      activeTaskRef.value = taskObj;
      activeModeRef.value = 'edit';
    } catch (e) {
      // ignore
    }
  }

  /** Convenience getter so existing `mgr.flatTasks` accesses still work. */
  get flatTasks(): Ref<Task[]> {
    return this.flatTasksRef;
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Backwards-compatible alias: prefer `TaskRepository`, keep `TaskService`
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { TaskRepository as TaskService };

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Module-level singleton + re-exported free functions
//
// All the previously exported free functions are now thin delegates to the
// singleton.  Every existing import/call-site (StorageController,
// presentationRepository, hiddenGroupSummary, tests) continues to work with
// zero changes.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const _singleton = new TaskRepository();

/**
 * The singleton's reactive flat task list.
 * StorageController and tests import this directly as `flatTasks`.
 */
export const flatTasks = _singleton.flatTasksRef;

// â”€â”€ Backward-compat free function re-exports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const setTime = (t: any): void => _singleton.setTime(t);
export const addTask = (
  date: string,
  taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
): Task => _singleton.addTask(date, taskData);
export const updateTask = (
  date: string,
  taskOrId: Task | string,
  maybeUpdates?: any,
  time?: any,
): void => _singleton.updateTask(date, taskOrId, maybeUpdates, time);
export const deleteTask = (date: string, taskId: string): boolean =>
  _singleton.deleteTask(date, taskId);
export const toggleTaskComplete = (date: string, taskId: string): void =>
  _singleton.toggleTaskComplete(date, taskId);
export const undoCycleDone = (date: string, taskId: string): boolean =>
  _singleton.undoCycleDone(date, taskId);
export const getTasksInRange = (startDate: string, endDate: string): Task[] =>
  _singleton.getTasksInRange(startDate, endDate);
export const getAllTasks = (): Task[] => _singleton.getAllTasks();
export const listFromDays = (daysArg?: Record<string, any>): Task[] =>
  _singleton.listFromDays(daysArg);
export const getFlatList = (time?: any): Task[] => _singleton.getFlatList(time);
export const getTasksByCategory = (c: Task['category']): Task[] => _singleton.getTasksByCategory(c);
export const getTasksByPriority = (p: Task['priority']): Task[] => _singleton.getTasksByPriority(p);
export const getIncompleteTasks = (): Task[] => _singleton.getIncompleteTasks();
export const buildFlatTasksList = (daysArg?: Record<string, any>): Task[] =>
  _singleton.buildFlatTasksList(daysArg);
export const applyActiveSelection = (
  activeTaskRef: Ref<Task | null>,
  activeModeRef: Ref<'add' | 'edit' | 'preview'>,
  payload: string | number | Task | null,
): void => _singleton.applyActiveSelection(activeTaskRef, activeModeRef, payload);
