import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type { Task } from '../task/types';
import type { OrganiserData } from './types';
import * as taskService from '../task/taskService';
import { storage } from './storage';
import logger from 'src/utils/logger';
import {
  addGroup as addGroupService,
  updateGroup as updateGroupService,
  deleteGroup as deleteGroupService,
} from '../group/groupService';
import type { CreateGroupInput } from '../group/groupService';
import { getGroupsByParent as getGroupsByParentUtil, buildGroupTree } from '../group/groupUtils';

//// reactive state refs
export const organiserData = ref<OrganiserData>({
  days: {},
  groups: [],
  lastModified: new Date().toISOString(),
});

export const currentDate = ref<string>(new Date().toISOString().split('T')[0] ?? '');

export const previewTaskId = ref<string | null>(null);
export const previewTaskPayload = ref<Record<string, unknown> | null>(null);

export const activeGroup = ref<{ label: string; value: string | null } | null>(null);

//// API functions
export async function saveData() {
  try {
    const groupsOrig = Array.isArray(organiserData.value.groups) ? organiserData.value.groups : [];
    const groupsForSave = groupsOrig.map((g: any) => ({ ...(g || {}), tasks: [] }));
    const groupIndex = new Map<string, any>();
    for (const g of groupsForSave) {
      groupIndex.set(String(g.id), g);
    }
    for (const dKey of Object.keys(organiserData.value.days)) {
      const day = organiserData.value.days[dKey];
      if (!day || !Array.isArray(day.tasks)) continue;
      for (const t of day.tasks) {
        const gid = t && (t.groupId ?? null);
        if (gid != null && groupIndex.has(String(gid))) {
          groupIndex.get(String(gid)).tasks.push(t);
        }
      }
    }
    const dataToSave: OrganiserData = {
      ...organiserData.value,
      groups: groupsForSave,
    };
    await storage.saveData(dataToSave);
  } catch (err) {
    try {
      await storage.saveData(organiserData.value as OrganiserData);
    } catch (e) {
      logger.error('Failed to save organiser data', e);
      throw e;
    }
  }
}

// No runtime context required — module-owned `organiserData` is used directly.

export async function addTask(date: string, taskData: any): Promise<Task> {
  const task = taskService.addTask(organiserData.value, date, taskData);
  await saveData();
  return task;
}

export async function updateTask(date: string, id: string, updates: any): Promise<void> {
  taskService.updateTask(organiserData.value, date, id, updates);
  await saveData();
}

export async function deleteTask(date: string, taskId: string): Promise<void> {
  taskService.deleteTask(organiserData.value, date, taskId);
  await saveData();
}

export async function toggleTaskComplete(date: string, taskId: string): Promise<void> {
  taskService.toggleTaskComplete(organiserData.value, date, taskId);
  await saveData();
}

export async function undoCycleDone(date: string, taskId: string): Promise<boolean> {
  const changed = taskService.undoCycleDone(organiserData.value, date, taskId);
  if (changed) await saveData();
  return changed;
}

export async function updateDayNotes(date: string, notes: string): Promise<void> {
  const day =
    organiserData.value.days[date] ??
    (organiserData.value.days[date] = { date, tasks: [], notes: '' } as any);
  day.notes = notes;
  await saveData();
}

export function getTasksInRange(startDate: string, endDate: string) {
  return taskService.getTasksInRange(organiserData.value, startDate, endDate);
}

export function getTasksByCategory(category: Task['category']) {
  return taskService.getTasksByCategory(organiserData.value, category);
}

export function getTasksByPriority(priority: Task['priority']) {
  return taskService.getTasksByPriority(organiserData.value, priority);
}

export function getIncompleteTasks() {
  return taskService.getIncompleteTasks(organiserData.value);
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

// Group management helpers
export async function addGroup(groupInput: CreateGroupInput) {
  const group = addGroupService(organiserData.value, groupInput);
  await saveData();
  return group;
}

export async function updateGroup(groupId: string, updates: Partial<any>): Promise<void> {
  updateGroupService(organiserData.value, groupId, updates);
  await saveData();
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { groupHasTasks } = deleteGroupService(organiserData.value, groupId);
  await saveData();
  if (!groupHasTasks) {
    try {
      const storageMod = await import('./storage');
      const del = (storageMod as any).deleteGroupFile;
      if (typeof del === 'function') {
        await del.call(storageMod, groupId);
      }
    } catch (err) {
      // ignore deletion errors here
    }
  }
}

export function getGroupsByParent(parentId?: string) {
  return getGroupsByParentUtil(organiserData.value.groups, parentId);
}

export const groupTree = computed(() => buildGroupTree(organiserData.value.groups));
