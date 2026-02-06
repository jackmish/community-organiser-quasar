import type { Task } from './types';
import * as taskService from './taskService';
import { ref } from 'vue';
import type { Ref } from 'vue';
import { saveData } from 'src/utils/storageUtils';

export type PreviewPayload = string | number | Task | null;

// Factory to create a task API bound to the given state object
export function createTaskApi(groupApi?: any, timeApi?: any) {
  const activeTask = ref<Task | null>(null);
  const activeMode = ref<'add' | 'edit' | 'preview'>('add');

  // Construct a task service instance bound to `timeApi`.
  const svc = taskService.createTaskService(timeApi);

  const setTask = (payload: PreviewPayload) =>
    svc.applyActiveSelection(activeTask, activeMode, payload as any);

  function setMode(m: 'add' | 'edit' | 'preview') {
    activeMode.value = m;
    if (m === 'add') activeTask.value = null;
  }

  return {
    active: { task: activeTask, mode: activeMode, setTask, setMode },
    add: async (date: string, taskData: any) => {
      const t = svc.addTask(date, taskData);
      await saveData();
      return t;
    },
    update: async (date: string, task: Task) => {
      svc.updateTask(date, task);
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
  } as const;
}
