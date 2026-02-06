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

  const getAll = () =>
    taskService.flatTasks ? taskService.flatTasks.value : taskService.buildFlatTasksList();

  const setTask = (payload: PreviewPayload) =>
    taskService.applyActiveSelection(activeTask, activeMode, timeApi, payload as any);

  function setMode(m: 'add' | 'edit' | 'preview') {
    activeMode.value = m;
    if (m === 'add') activeTask.value = null;
  }

  return {
    active: { task: activeTask, mode: activeMode, setTask, setMode },
    add: async (date: string, taskData: any) => {
      const t = taskService.add(date, taskData);
      await saveData();
      return t;
    },
    update: async (date: string, id: string, updates: any) => (
      taskService.update(date, id, updates),
      await saveData()
    ),
    delete: async (date: string, id: string) => (taskService.remove(date, id), await saveData()),
    status: {
      toggleComplete: async (date: string, id: string) => (
        taskService.toggleCompleteDefault(date, id),
        await saveData()
      ),
      undoCycleDone: async (date: string, id: string) => {
        const changed = taskService.undoCycleDoneDefault(date, id);
        if (changed) await saveData();
        return changed;
      },
    },
    list: {
      all: () => getAll().slice(),
      inRange: (s: string, e: string) =>
        getAll().filter((t) => String(t.date) >= String(s) && String(t.date) <= String(e)),
      byCategory: (c: Task['category']) => getAll().filter((t) => t.category === c),
      byPriority: (p: Task['priority']) => getAll().filter((t) => t.priority === p),
      incomplete: () => getAll().filter((t) => !t.status_id || Number(t.status_id) === 0),
      filter: (fn: (t: Task) => boolean) => getAll().filter(fn),
      sort: (compare?: (a: Task, b: Task) => number) =>
        getAll()
          .slice()
          .sort(
            compare ??
              ((a, b) => a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority)),
          ),
      aggregate: <R>(fn: (acc: R, t: Task) => R, init: R) => getAll().reduce(fn, init),
    },
  } as const;
}
