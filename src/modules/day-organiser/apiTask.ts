import type { Task } from '../task/types';
import type { OrganiserData } from './types';
import * as taskService from '../task/taskService';
import type { Ref } from 'vue';

export type DayOrganiserState = {
  organiserData: Ref<OrganiserData>;
  currentDate: Ref<string>;
  previewTaskId: Ref<string | null>;
  previewTaskPayload: Ref<Task | null>;
  activeGroup: Ref<{ label: string; value: string | null } | null>;
  saveData: () => Promise<void>;
};

export type PreviewPayload = string | number | Task | null;

// Factory to create a task API bound to the given state object
export function createTaskApi(state: DayOrganiserState) {
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

    getTasksInRange: (start: string, end: string) =>
      taskService.getTasksInRange(state.organiserData.value, start, end),

    getTasksByCategory: (category: Task['category']) =>
      taskService.getTasksByCategory(state.organiserData.value, category),

    getTasksByPriority: (priority: Task['priority']) =>
      taskService.getTasksByPriority(state.organiserData.value, priority),

    getIncompleteTasks: () => taskService.getIncompleteTasks(state.organiserData.value),

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
