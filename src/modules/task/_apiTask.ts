import type { Task } from './types';
import * as taskService from './services/taskService';
import { ref } from 'vue';
import { saveData } from 'src/utils/storageUtils';
import { parse } from 'path';

export type PreviewPayload = string | number | Task | null;

// Factory to create a task API bound to the given state object
export function construct(groupApi?: any, timeApi?: any) {
  // Construct a task service instance. Provide a shared `state` object so the
  // service can bind parsed-lines and watchers to the active refs directly.
  // Keep `state` simple and let TypeScript infer the ref types. The
  // service will attach `parsedLines` to this object when available.
  const state = {
    activeTask: ref<Task | null>(null),
    activeMode: ref<'add' | 'edit' | 'preview'>('add'),
    parsedLines: ref([]),
  };

  const svc = taskService.construct(timeApi, state as any);

  // `state.parsedLines` is attached by the service when available.

  return {
    active: {
      task: state.activeTask,
      mode: state.activeMode,
      setTask: (payload: PreviewPayload) =>
        svc.applyActiveSelection(state.activeTask, state.activeMode, payload as any),
      setMode: (m: 'add' | 'edit' | 'preview') => {
        state.activeMode.value = m;
        if (m === 'add') state.activeTask.value = null;
      },
    },
    add: async (date: string, taskData: any) => {
      const t = svc.addTask(date, taskData);
      await saveData();
      return t;
    },

    update: async (date: string, taskOrId: Task | string, maybeUpdates?: any) => {
      svc.updateTask(date, taskOrId as any, maybeUpdates);
      await saveData();
    },
    delete: async (date: string, id: string) => {
      const removed = svc.deleteTask(date, id);
      await saveData();
      return removed;
    },
    status: {
      toggleComplete: async (date: string, id: string) => {
        svc.toggleTaskComplete(date, id);
        await saveData();
      },
      undoCycleDone: async (date: string, id: string) => {
        const changed = svc.undoCycleDone(date, id);
        if (changed) await saveData();
        return changed;
      },
    },
    list: {
      all: () => svc.getAll().slice(),
      inRange: (s: string, e: string) => svc.getTasksInRange(s, e),
      byCategory: (c: Task['category']) => svc.getTasksByCategory(c),
      byPriority: (p: Task['priority']) => svc.getTasksByPriority(p),
      incomplete: () => svc.getIncompleteTasks(),
      filter: (fn: (t: Task) => boolean) => svc.getAll().filter(fn),
      sort: (compare?: (a: Task, b: Task) => number) =>
        svc
          .getAll()
          .slice()
          .sort(
            compare ??
              ((a, b) => a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority)),
          ),
      aggregate: <R>(fn: (acc: R, t: Task) => R, init: R) => svc.getAll().reduce(fn, init),
    },
    subtaskLine: {
      parsedLines: state.parsedLines,
      add: async (text: string) => {
        const res = await (svc as any).services.subtaskLine.add(state.activeTask.value, text);
        if (res && res.newDesc) await saveData();
        return res;
      },
      toggleStatus: async (task: any, lineIndex: number) => {
        const res = await (svc as any).services.subtaskLine.toggleStatus(task, lineIndex);
        if (res && res.newDesc) await saveData();
        return res;
      },
    },
  } as const;
}
