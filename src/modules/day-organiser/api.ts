import { ref } from 'vue';
import type { Ref } from 'vue';
import type { Task } from '../task/types';
import type { OrganiserData } from './types';
import * as taskService from '../task/taskService';

// Module-owned reactive state (exported for callers)
const organiserDataRef = ref<OrganiserData>({
  days: {},
  groups: [],
  lastModified: new Date().toISOString(),
});
export const organiserData = organiserDataRef;

const currentDateRef = ref<string>(new Date().toISOString().split('T')[0] ?? '');
export const currentDate = currentDateRef;

export const previewTaskId = ref<string | null>(null);
export const previewTaskPayload = ref<Record<string, unknown> | null>(null);

export const activeGroup = ref<{ label: string; value: string | null } | null>(null);

let saveDataFn: (() => Promise<void>) | null = null;

export function setContext(ctx: { saveData: () => Promise<void> }) {
  saveDataFn = ctx.saveData;
}

function ensureContext(): {
  organiserDataRef: Ref<OrganiserData>;
  saveDataFn: () => Promise<void>;
} {
  if (!saveDataFn) throw new Error('API context not set');
  return { organiserDataRef, saveDataFn } as {
    organiserDataRef: Ref<OrganiserData>;
    saveDataFn: () => Promise<void>;
  };
}

export async function addTask(date: string, taskData: any): Promise<Task> {
  const { organiserDataRef: od, saveDataFn: save } = ensureContext();
  const task = taskService.addTask(od.value, date, taskData);
  await save();
  return task;
}

export async function updateTask(date: string, id: string, updates: any): Promise<void> {
  const { organiserDataRef: od, saveDataFn: save } = ensureContext();
  taskService.updateTask(od.value, date, id, updates);
  await save();
}

export async function deleteTask(date: string, taskId: string): Promise<void> {
  const { organiserDataRef: od, saveDataFn: save } = ensureContext();
  const removed = taskService.deleteTask(od.value, date, taskId);
  if (removed) {
    await save();
    return;
  }
  await save();
}

export async function toggleTaskComplete(date: string, taskId: string): Promise<void> {
  const { organiserDataRef: od, saveDataFn: save } = ensureContext();
  taskService.toggleTaskComplete(od.value, date, taskId);
  await save();
}

export async function undoCycleDone(date: string, taskId: string): Promise<boolean> {
  const { organiserDataRef: od, saveDataFn: save } = ensureContext();
  const changed = taskService.undoCycleDone(od.value, date, taskId);
  if (changed) await save();
  return changed;
}

export async function updateDayNotes(date: string, notes: string): Promise<void> {
  const { organiserDataRef: od, saveDataFn: save } = ensureContext();
  const day = od.value.days[date] ?? (od.value.days[date] = { date, tasks: [], notes: '' } as any);
  day.notes = notes;
  await save();
}

export function getTasksInRange(startDate: string, endDate: string) {
  const { organiserDataRef: od } = ensureContext();
  return taskService.getTasksInRange(od.value, startDate, endDate);
}

export function getTasksByCategory(category: Task['category']) {
  const { organiserDataRef: od } = ensureContext();
  return taskService.getTasksByCategory(od.value, category);
}

export function getTasksByPriority(priority: Task['priority']) {
  const { organiserDataRef: od } = ensureContext();
  return taskService.getTasksByPriority(od.value, priority);
}

export function getIncompleteTasks() {
  const { organiserDataRef: od } = ensureContext();
  return taskService.getIncompleteTasks(od.value);
}

export function setPreviewTask(payload: string | number | Record<string, unknown> | null) {
  if (payload == null) {
    previewTaskId.value = null;
    previewTaskPayload.value = null;
    return;
  }
  if (typeof payload === 'string' || typeof payload === 'number') {
    previewTaskId.value = String(payload);
    previewTaskPayload.value = null;
    return;
  }
  const p = payload;
  const pid = p['id'];
  previewTaskId.value = typeof pid === 'string' || typeof pid === 'number' ? String(pid) : null;
  previewTaskPayload.value = p;
}
