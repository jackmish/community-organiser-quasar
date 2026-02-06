import type { Task } from './types';
import type { OrganiserData } from '../day-organiser/types';
import * as taskService from './taskService';
import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { app } from 'src/services/appService';
import { saveData } from 'src/utils/storageUtils';

export type PreviewPayload = string | number | Task | null;

// Factory to create a task API bound to the given state object
export function createTaskApi(groupApi?: any, timeApi?: any) {
  // Internal UI refs now live inside the task API so the task API is the canonical source
  const activeTask = ref<Task | null>(null);
  const activeMode = ref<'add' | 'edit' | 'preview'>('add');

  // helper to build organiser-like refs from refactored APIs
  const _organiserRef = () => ({
    days: (timeApi && timeApi.days ? timeApi.days.value : {}) || {},
    groups: (groupApi && groupApi.list && groupApi.list.all ? groupApi.list.all.value : []) || [],
    lastModified:
      (timeApi && timeApi.lastModified ? timeApi.lastModified.value : new Date().toISOString()) ||
      new Date().toISOString(),
  });
  // persistence uses global `app('storage')` service (lazy-resolved)

  // Ensure mode-driven clearing of selection lives inside the API so views don't repeat logic
  function setTask(payload: PreviewPayload) {
    if (payload == null) {
      activeTask.value = null;
      activeMode.value = 'add';
      return;
    }
    if (typeof payload === 'string' || typeof payload === 'number') {
      const all = taskService.getTasksInRange(_organiserRef() as any, '1970-01-01', '9999-12-31');
      const found = all.find((t) => t.id === String(payload)) || null;
      if (found) {
        activeTask.value = found;
        activeMode.value = 'preview';
        try {
          if (timeApi && timeApi.setCurrentDate) {
            timeApi.setCurrentDate((found as any).date || (found as any).eventDate || null);
          }
        } catch (e) {
          // ignore
        }
      }
      return;
    }
    // payload is a Task
    activeTask.value = payload;
    activeMode.value = 'preview';
  }

  function setMode(m: 'add' | 'edit' | 'preview') {
    activeMode.value = m;
    if (m === 'add') activeTask.value = null;
  }
  watch(activeMode, (val) => {
    if (val === 'add') {
      activeTask.value = null;
    }
  });
  return {
    // Shared UI state for tasks
    active: {
      task: activeTask,
      mode: activeMode,
      setTask,
      setMode,
    },
    add: async (date: string, taskData: any): Promise<Task> => {
      const organiserData = _organiserRef();
      const task = taskService.addTask(organiserData as any, date, taskData);
      await saveData();
      return task;
    },

    update: async (date: string, id: string, updates: any): Promise<void> => {
      taskService.updateTask(_organiserRef() as any, date, id, updates);
      await saveData();
    },

    delete: async (date: string, taskId: string): Promise<void> => {
      taskService.deleteTask(_organiserRef() as any, date, taskId);
      await saveData();
    },
    status: {
      toggleComplete: async (date: string, taskId: string): Promise<void> => {
        taskService.toggleTaskComplete(_organiserRef() as any, date, taskId);
        {
          await saveData();
        }
      },

      undoCycleDone: async (date: string, taskId: string): Promise<boolean> => {
        const changed = taskService.undoCycleDone(_organiserRef() as any, date, taskId);
        if (changed) {
          await saveData();
        }
        return changed;
      },
    },
    // persistence handled via global service `app('storage')`
    // Nested list helpers: `api.task.list.inRange(...)`, `api.task.list.byCategory(...)`, etc.
    list: {
      all: () => taskService.getTasksInRange(_organiserRef() as any, '1970-01-01', '9999-12-31'),
      inRange: (start: string, end: string) =>
        taskService.getTasksInRange(_organiserRef() as any, start, end),
      byCategory: (category: Task['category']) =>
        taskService.getTasksByCategory(_organiserRef() as any, category),
      byPriority: (priority: Task['priority']) =>
        taskService.getTasksByPriority(_organiserRef() as any, priority),
      incomplete: () => taskService.getIncompleteTasks(_organiserRef() as any),

      filter: (fn: (t: Task) => boolean) =>
        taskService.getTasksInRange(_organiserRef() as any, '1970-01-01', '9999-12-31').filter(fn),
      sort: (compare?: (a: Task, b: Task) => number) => {
        const arr = taskService
          .getTasksInRange(_organiserRef() as any, '1970-01-01', '9999-12-31')
          .slice();
        arr.sort(
          compare ??
            ((a: Task, b: Task) =>
              a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority)),
        );
        return arr;
      },
      aggregate: <R>(fn: (acc: R, t: Task) => R, init: R) =>
        taskService
          .getTasksInRange(_organiserRef() as any, '1970-01-01', '9999-12-31')
          .reduce(fn, init),
    },

    // Note: use `active.setTask` to set preview/active task
  } as const;
}
