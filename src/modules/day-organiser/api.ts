import type { Ref } from 'vue';
import type { Task } from '../task/types';
import type { OrganiserData } from './types';
import * as taskService from '../task/taskService';

// Minimal module-level context. `useDayOrganiser` will call `setContext` to
// provide these; functions below use them when invoked.
let organiserDataRef: Ref<OrganiserData> | null = null;
let saveDataFn: (() => Promise<void>) | null = null;
// Optional preview refs (may be provided by the caller via `setContext`)
let previewTaskIdRef: Ref<string | null> | null = null;
let previewTaskPayloadRef: Ref<Record<string, unknown> | null> | null = null;

export function setContext(ctx: {
  organiserData: Ref<OrganiserData>;
  saveData: () => Promise<void>;
  previewTaskId?: Ref<string | null>;
  previewTaskPayload?: Ref<Record<string, unknown> | null>;
}) {
  organiserDataRef = ctx.organiserData;
  saveDataFn = ctx.saveData;
  if (ctx.previewTaskId) previewTaskIdRef = ctx.previewTaskId;
  if (ctx.previewTaskPayload) previewTaskPayloadRef = ctx.previewTaskPayload;
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

// Preview helper: allows callers to set the preview task id or payload.
export function setPreviewTask(payload: string | number | Record<string, unknown> | null) {
  if (!previewTaskIdRef || !previewTaskPayloadRef) {
    throw new Error('Preview refs not provided to API context');
  }
  if (payload == null) {
    previewTaskIdRef.value = null;
    previewTaskPayloadRef.value = null;
    return;
  }
  if (typeof payload === 'string' || typeof payload === 'number') {
    previewTaskIdRef.value = String(payload);
    previewTaskPayloadRef.value = null;
    return;
  }
  const p = payload;
  const pid = p['id'];
  previewTaskIdRef.value = typeof pid === 'string' || typeof pid === 'number' ? String(pid) : null;
  previewTaskPayloadRef.value = p;
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
