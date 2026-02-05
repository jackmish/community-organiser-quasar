import type { Ref } from 'vue';
import type { Task } from '../task/types';
import type { OrganiserData } from './types';
import { addTask as addTaskService, updateTask as updateTaskService } from '../task/taskService';

// Minimal module-level context. `useDayOrganiser` will call `setContext` to
// provide these; functions below use them when invoked.
let organiserDataRef: Ref<OrganiserData> | null = null;
let saveDataFn: (() => Promise<void>) | null = null;

export function setContext(ctx: {
  organiserData: Ref<OrganiserData>;
  saveData: () => Promise<void>;
}) {
  organiserDataRef = ctx.organiserData;
  saveDataFn = ctx.saveData;
}

function ensureContext(): {
  organiserDataRef: Ref<OrganiserData>;
  saveDataFn: () => Promise<void>;
} {
  if (!organiserDataRef || !saveDataFn) throw new Error('API context not set');
  return { organiserDataRef, saveDataFn } as {
    organiserDataRef: Ref<OrganiserData>;
    saveDataFn: () => Promise<void>;
  };
}

export async function addTask(date: string, taskData: any): Promise<Task> {
  const { organiserDataRef: od, saveDataFn: save } = ensureContext();
  const task = addTaskService(od.value, date, taskData);
  await save();
  return task;
}

export async function updateTask(date: string, id: string, updates: any): Promise<void> {
  const { organiserDataRef: od, saveDataFn: save } = ensureContext();
  updateTaskService(od.value, date, id, updates);
  await save();
}
