import type { Task } from './types';
import * as taskService from './taskService';
import { createSubtaskLines } from './subtaskLines';
import { ref } from 'vue';
import { saveData } from 'src/utils/storageUtils';

export type PreviewPayload = string | number | Task | null;

// Factory to create a task API bound to the given state object
export function construct(groupApi?: any, timeApi?: any) {
  // Construct a task service instance
  const svc = taskService.construct(timeApi);

  const activeTask = ref<Task | null>(null);
  const activeMode = ref<'add' | 'edit' | 'preview'>('add');

  // parsed lines and watcher for the active task are managed by a dedicated
  // helper so UI components can read `api.task.subtaskLine.parsedLines`.
  const subtaskLines = createSubtaskLines(activeTask);

  return {
    active: {
      task: activeTask,
      mode: activeMode,
      setTask: (payload: PreviewPayload) =>
        svc.applyActiveSelection(activeTask, activeMode, payload as any),
      setMode: (m: 'add' | 'edit' | 'preview') => {
        activeMode.value = m;
        if (m === 'add') activeTask.value = null;
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
      parsedLines: subtaskLines.parsedLines,
      add: async (text: string) => {
        const res = await (svc as any).subtaskLine.add(activeTask.value, text);
        if (res && res.newDesc) await saveData();
        return res;
      },
      toggleStatus: async (task: any, lineIndex: number) => {
        const res = await (svc as any).subtaskLine.toggleStatus(task, lineIndex);
        if (res && res.newDesc) await saveData();
        return res;
      },
    },
  } as const;
}
