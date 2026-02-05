import type { Task } from '../task/types';
import type { OrganiserData } from './types';
import * as taskService from '../task/taskService';

// Factory to create a task API bound to the current organiserData getter and saveData
export function createTaskApi(
  getOrganiserData: () => OrganiserData,
  saveData: () => Promise<void>,
) {
  return {
    add: async (date: string, taskData: any): Promise<Task> => {
      const organiserData = getOrganiserData();
      const task = taskService.addTask(organiserData, date, taskData);
      await saveData();
      return task;
    },

    update: async (date: string, id: string, updates: any): Promise<void> => {
      taskService.updateTask(getOrganiserData(), date, id, updates);
      await saveData();
    },

    delete: async (date: string, taskId: string): Promise<void> => {
      taskService.deleteTask(getOrganiserData(), date, taskId);
      await saveData();
    },

    toggleComplete: async (date: string, taskId: string): Promise<void> => {
      taskService.toggleTaskComplete(getOrganiserData(), date, taskId);
      await saveData();
    },

    undoCycleDone: async (date: string, taskId: string): Promise<boolean> => {
      const changed = taskService.undoCycleDone(getOrganiserData(), date, taskId);
      if (changed) await saveData();
      return changed;
    },

    updateDayNotes: async (date: string, notes: string): Promise<void> => {
      const organiserData = getOrganiserData();
      const day =
        organiserData.days[date] ??
        (organiserData.days[date] = { date, tasks: [], notes: '' } as any);
      day.notes = notes;
      await saveData();
    },

    getTasksInRange: (start: string, end: string) =>
      taskService.getTasksInRange(getOrganiserData(), start, end),

    getTasksByCategory: (category: Task['category']) =>
      taskService.getTasksByCategory(getOrganiserData(), category),

    getTasksByPriority: (priority: Task['priority']) =>
      taskService.getTasksByPriority(getOrganiserData(), priority),

    getIncompleteTasks: () => taskService.getIncompleteTasks(getOrganiserData()),
  } as const;
}
