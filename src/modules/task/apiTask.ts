import type { Task } from './types';
import { TaskManager } from './managers/taskManager';
import * as timeManager from './managers/timeManager/timeManager';
import { markRaw, ref } from 'vue';
import { saveData } from 'src/utils/storageUtils';
import { defineStore } from 'pinia';

export type PreviewPayload = string | number | Task | null;

// ── Namespace classes ─────────────────────────────────────────────────────────
// Each class owns one concern. markRaw() in the store setup prevents Pinia from
// wrapping them in reactive() — the Vue refs inside them stay reactive on their own.

class TaskActive {
  readonly task = ref<Task | null>(null);
  readonly mode = ref<'add' | 'edit' | 'preview'>('add');

  constructor(private readonly mgr: TaskManager) {}

  setTask(payload: PreviewPayload): void {
    if (payload === undefined) return;
    this.mgr.applyActiveSelection(this.task, this.mode, payload as any);
  }

  setMode(m: 'add' | 'edit' | 'preview'): void {
    this.mode.value = m;
    if (m === 'add') this.task.value = null;
  }
}

class TaskList {
  constructor(private readonly mgr: TaskManager) {}

  all() {
    return this.mgr.getAll().slice();
  }
  inRange(s: string, e: string) {
    return this.mgr.getTasksInRange(s, e);
  }
  byCategory(c: Task['category']) {
    return this.mgr.getTasksByCategory(c);
  }
  byPriority(p: Task['priority']) {
    return this.mgr.getTasksByPriority(p);
  }
  incomplete() {
    return this.mgr.getIncompleteTasks();
  }
  filter(fn: (t: Task) => boolean) {
    return this.mgr.getAll().filter(fn);
  }
  sort(compare?: (a: Task, b: Task) => number) {
    return this.mgr
      .getAll()
      .slice()
      .sort(
        compare ??
          ((a: Task, b: Task) =>
            a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority)),
      );
  }
  forDay(d: string) {
    return this.mgr.getTasksForDay(String(d || ''));
  }
  aggregate<R>(fn: (acc: R, t: Task) => R, init: R) {
    return this.mgr.getAll().reduce(fn, init);
  }
}

class TaskSubtaskLine {
  readonly parsedLines = ref<any[]>([]);

  constructor(
    private readonly mgr: TaskManager,
    private readonly active: TaskActive,
  ) {}

  async add(text: string) {
    const res = await this.mgr.managers.subtaskLine.add(this.active.task.value, text);
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
  }

  async toggleStatus(task: any, lineIndex: number) {
    const res = await this.mgr.managers.subtaskLine.toggleStatus(task, lineIndex);
    if (res && res.newDesc) await saveData();
    return res;
  }
}

class TaskStatus {
  constructor(private readonly mgr: TaskManager) {}

  async toggleComplete(date: string, id: string): Promise<void> {
    this.mgr.toggleTaskComplete(date, id);
    await saveData();
  }

  async undoCycleDone(date: string, id: string): Promise<boolean> {
    const changed = this.mgr.undoCycleDone(date, id);
    if (changed) await saveData();
    return changed;
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useTaskStore = defineStore('task', () => {
  const time = markRaw(timeManager.construct());
  const mgr = markRaw(new TaskManager({ time }));
  const active = markRaw(new TaskActive(mgr));
  const list = markRaw(new TaskList(mgr));
  const subtaskLine = markRaw(new TaskSubtaskLine(mgr, active));
  const status = markRaw(new TaskStatus(mgr));

  return {
    time,
    mgr,
    active,
    list,
    subtaskLine,
    status,

    async add(date: string, taskData: any) {
      const t = mgr.addTask(date, taskData);
      await saveData();
      return t;
    },

    async update(date: string, taskOrId: Task | string, maybeUpdates?: any) {
      mgr.updateTask(date, taskOrId as any, maybeUpdates);
      await saveData();
    },

    async delete(date: string, id: string) {
      const removed = mgr.deleteTask(date, id);
      await saveData();
      return removed;
    },
  };
});

// ── Type alias (kept for any callers that import ApiTask by name) ─────────────
export type ApiTask = ReturnType<typeof useTaskStore>;
