import type { Task } from './types';
import type { OrganiserData } from '../day-organiser/types';
import * as taskService from './taskService';
import type { Ref } from 'vue';

export type PreviewPayload = string | number | Task | null;

// Factory to create a task API bound to the given state object
export function createTaskApi(state: any) {
  return {
    add: async (date: string, taskData: any): Promise<Task> => {
      const organiserData = state.organiserData.value;
      const task = taskService.addTask(organiserData, date, taskData);
      await state.saveData();
      return task;
    },

    update: async (date: string, id: string, updates: any): Promise<void> => {
      taskService.updateTask(state.organiserData.value, date, id, updates);
      await state.saveData();
    },

    delete: async (date: string, taskId: string): Promise<void> => {
      taskService.deleteTask(state.organiserData.value, date, taskId);
      await state.saveData();
    },

    toggleComplete: async (date: string, taskId: string): Promise<void> => {
      taskService.toggleTaskComplete(state.organiserData.value, date, taskId);
      await state.saveData();
    },

    undoCycleDone: async (date: string, taskId: string): Promise<boolean> => {
      const changed = taskService.undoCycleDone(state.organiserData.value, date, taskId);
      if (changed) await state.saveData();
      return changed;
    },

    updateDayNotes: async (date: string, notes: string): Promise<void> => {
      const organiserData = state.organiserData.value;
      const day =
        organiserData.days[date] ??
        (organiserData.days[date] = { date, tasks: [], notes: '' } as any);
      day.notes = notes;
      await state.saveData();
    },

    // Nested list helpers: `api.task.list.inRange(...)`, `api.task.list.byCategory(...)`, etc.
    list: {
      all: () => taskService.getTasksInRange(state.organiserData.value, '1970-01-01', '9999-12-31'),
      inRange: (start: string, end: string) =>
        taskService.getTasksInRange(state.organiserData.value, start, end),
      byCategory: (category: Task['category']) =>
        taskService.getTasksByCategory(state.organiserData.value, category),
      byPriority: (priority: Task['priority']) =>
        taskService.getTasksByPriority(state.organiserData.value, priority),
      incomplete: () => taskService.getIncompleteTasks(state.organiserData.value),

      filter: (fn: (t: Task) => boolean) =>
        taskService
          .getTasksInRange(state.organiserData.value, '1970-01-01', '9999-12-31')
          .filter(fn),
      sort: (compare?: (a: Task, b: Task) => number) => {
        const arr = taskService
          .getTasksInRange(state.organiserData.value, '1970-01-01', '9999-12-31')
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
          .getTasksInRange(state.organiserData.value, '1970-01-01', '9999-12-31')
          .reduce(fn, init),
    },

    setPreviewTask: (payload: string | number | Task | null) => {
      if (payload == null) {
        state.previewTaskId.value = null;
        state.previewTaskPayload.value = null;
        return;
      }
      if (typeof payload === 'string' || typeof payload === 'number') {
        state.previewTaskId.value = String(payload);
        state.previewTaskPayload.value = null;
        return;
      }
      const p = payload;
      state.previewTaskId.value = p.id ?? null;
      state.previewTaskPayload.value = p;
    },
  } as const;
}
