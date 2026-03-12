import type { Task } from './types';
import { TaskManager } from './managers/taskManager';
import * as timeManager from './managers/timeManager/timeManager';
import { markRaw, ref } from 'vue';
import { saveData } from 'src/utils/storageUtils';
import { defineStore } from 'pinia';

export type PreviewPayload = string | number | Task | null;

export const useTaskStore = defineStore('task', () => {
  // ── core reactive state ──────────────────────────────────────────────────
  const activeTask = ref<Task | null>(null);
  const activeMode = ref<'add' | 'edit' | 'preview'>('add');
  const parsedLines = ref<any[]>([]);

  // ── infrastructure (non-reactive singletons) ─────────────────────────────
  // markRaw keeps these plain objects and prevents Pinia from wrapping them in
  // reactive() – refs *inside* them (e.g. time.currentDate) remain reactive.
  const time = markRaw(timeManager.construct());

  // TaskManager only needs `.time`; pass a plain object satisfying TaskTimeProvider.
  const mgr: TaskManager = markRaw(new TaskManager({ time }));

  // ── nested namespaces ─────────────────────────────────────────────────────
  const active = markRaw({
    task: activeTask,
    mode: activeMode,
    setTask: (payload: PreviewPayload) => {
      if (payload === undefined) return;
      mgr.applyActiveSelection(activeTask, activeMode, payload as any);
    },
    setMode: (m: 'add' | 'edit' | 'preview') => {
      activeMode.value = m;
      if (m === 'add') activeTask.value = null;
    },
  });

  const list = markRaw({
    all: () => mgr.getAll().slice(),
    inRange: (s: string, e: string) => mgr.getTasksInRange(s, e),
    byCategory: (c: Task['category']) => mgr.getTasksByCategory(c),
    byPriority: (p: Task['priority']) => mgr.getTasksByPriority(p),
    incomplete: () => mgr.getIncompleteTasks(),
    filter: (fn: (t: Task) => boolean) => mgr.getAll().filter(fn),
    sort: (compare?: (a: Task, b: Task) => number) =>
      mgr
        .getAll()
        .slice()
        .sort(
          compare ??
            ((a: Task, b: Task) =>
              a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority)),
        ),
    forDay: (d: string) => mgr.getTasksForDay(String(d || '')),
    aggregate: <R>(fn: (acc: R, t: Task) => R, init: R) => mgr.getAll().reduce(fn, init),
  });

  const subtaskLine = markRaw({
    parsedLines,
    add: async (text: string) => {
      const res = await mgr.managers.subtaskLine.add(activeTask.value, text);
      try {
        if (res && res.newDesc) await saveData();
      } catch (err) {
        try {
          console.error('subtaskLine.add: failed to save data', err);
        } catch (e) {
          void e;
        }
      }
      return res;
    },
    toggleStatus: async (task: any, lineIndex: number) => {
      const res = await mgr.managers.subtaskLine.toggleStatus(task, lineIndex);
      if (res && res.newDesc) await saveData();
      return res;
    },
  });

  const status = markRaw({
    toggleComplete: async (date: string, id: string) => {
      mgr.toggleTaskComplete(date, id);
      await saveData();
    },
    undoCycleDone: async (date: string, id: string) => {
      const changed = mgr.undoCycleDone(date, id);
      if (changed) await saveData();
      return changed;
    },
  });

  // ── top-level CRUD ────────────────────────────────────────────────────────
  const add = async (date: string, taskData: any) => {
    const t = mgr.addTask(date, taskData);
    await saveData();
    return t;
  };

  const update = async (date: string, taskOrId: Task | string, maybeUpdates?: any) => {
    mgr.updateTask(date, taskOrId as any, maybeUpdates);
    await saveData();
  };

  const del = async (date: string, id: string) => {
    const removed = mgr.deleteTask(date, id);
    await saveData();
    return removed;
  };

  return { active, list, subtaskLine, status, add, update, delete: del, time, mgr };
});

// ── Legacy type export (keeps callers that import `ApiTask` compiling) ────────
// Defined as a standalone interface to avoid circular ReturnType<typeof useTaskStore>.
export interface ApiTask {
  time: ReturnType<typeof timeManager.construct>;
  mgr: TaskManager;
  active: ReturnType<typeof useTaskStore>['active'];
  list: ReturnType<typeof useTaskStore>['list'];
  status: ReturnType<typeof useTaskStore>['status'];
  subtaskLine: ReturnType<typeof useTaskStore>['subtaskLine'];
}
