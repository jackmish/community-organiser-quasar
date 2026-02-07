import type { Task } from './types';
import { TaskManager } from './managers/taskManager';
import { ref } from 'vue';
import type { Ref } from 'vue';
import { saveData } from 'src/utils/storageUtils';

export type PreviewPayload = string | number | Task | null;

// Factory to create a task API bound to the given state object
export class ApiTask {
  groupApi: any;
  timeApi: any;
  state: {
    activeTask: Ref<Task | null>;
    activeMode: Ref<'add' | 'edit' | 'preview'>;
    parsedLines: Ref<any[]>;
  };
  mgr: TaskManager;

  constructor(groupApi?: any, timeApi?: any) {
    this.groupApi = groupApi;
    this.timeApi = timeApi;
    this.state = {
      activeTask: ref<Task | null>(null),
      activeMode: ref<'add' | 'edit' | 'preview'>('add'),
      parsedLines: ref([]),
    };
    // Pass the ApiTask instance to the task service; taskService.construct will
    // detect and pull `time` and `state` from this object.
    this.mgr = new TaskManager(this);
  }

  get active() {
    const state = this.state;
    const mgr = this.mgr;
    return {
      task: state.activeTask,
      mode: state.activeMode,
      setTask: (payload: PreviewPayload) =>
        mgr.applyActiveSelection(state.activeTask, state.activeMode, payload as any),
      setMode: (m: 'add' | 'edit' | 'preview') => {
        state.activeMode.value = m;
        if (m === 'add') state.activeTask.value = null;
      },
    } as const;
  }

  get list() {
    const mgr = this.mgr;
    return {
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
              ((a, b) => a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority)),
          ),
      aggregate: <R>(fn: (acc: R, t: Task) => R, init: R) => mgr.getAll().reduce(fn, init),
    } as const;
  }

  get subtaskLine() {
    const mgr = this.mgr;
    const state = this.state;
    return {
      parsedLines: state.parsedLines,
      add: async (text: string) => {
        const res = await mgr.managers.subtaskLine.add(state.activeTask.value, text);
        if (res && res.newDesc) await saveData();
        return res;
      },
      toggleStatus: async (task: any, lineIndex: number) => {
        const res = await mgr.managers.subtaskLine.toggleStatus(task, lineIndex);
        if (res && res.newDesc) await saveData();
        return res;
      },
    } as const;
  }

  async add(date: string, taskData: any) {
    const t = this.mgr.addTask(date, taskData);
    await saveData();
    return t;
  }

  async update(date: string, taskOrId: Task | string, maybeUpdates?: any) {
    this.mgr.updateTask(date, taskOrId as any, maybeUpdates);
    await saveData();
  }

  async delete(date: string, id: string) {
    const removed = this.mgr.deleteTask(date, id);
    await saveData();
    return removed;
  }

  get status() {
    const mgr = this.mgr;
    return {
      toggleComplete: async (date: string, id: string) => {
        mgr.toggleTaskComplete(date, id);
        await saveData();
      },
      undoCycleDone: async (date: string, id: string) => {
        const changed = mgr.undoCycleDone(date, id);
        if (changed) await saveData();
        return changed;
      },
    } as const;
  }
}

export function construct(groupApi?: any, timeApi?: any) {
  return new ApiTask(groupApi, timeApi);
}
