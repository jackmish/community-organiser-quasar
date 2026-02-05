import { ref, computed } from 'vue';

import type { OrganiserData } from './types';
import { storage, deleteGroupFile } from './storage';

import {
  addGroup as addGroupService,
  updateGroup as updateGroupService,
  deleteGroup as deleteGroupService,
  prepareGroupsForSave,
} from '../group/groupService';
import type { CreateGroupInput } from '../group/groupService';
import { getGroupsByParent as getGroupsByParentUtil, buildGroupTree } from '../group/groupUtils';
import * as apiTask from './apiTask';
import type { Task } from '../task/types';

export type PreviewPayload = string | number | Task | null;

//// reactive state refs grouped into `state`
export const store = {
  organiserData: ref<OrganiserData>({
    days: {},
    groups: [],
    lastModified: new Date().toISOString(),
  }),
  currentDate: ref<string>(new Date().toISOString().split('T')[0] ?? ''),
  previewTaskId: ref<string | null>(null),
  previewTaskPayload: ref<Task | null>(null),
  activeGroup: ref<{ label: string; value: string | null } | null>(null),
  async saveData() {
    const dataToSave = prepareGroupsForSave(this.organiserData.value);
    await storage.saveData(dataToSave);
  },
};

export function saveData() {
  return store.saveData();
}
//// API helpers
// Create a bound task API using the factory from apiTask
const boundApiTask = apiTask.createTaskApi(store);

// Group management helpers
export async function addGroup(groupInput: CreateGroupInput) {
  const group = addGroupService(store.organiserData.value, groupInput);
  await saveData();
  return group;
}

export async function updateGroup(groupId: string, updates: Partial<any>): Promise<void> {
  updateGroupService(store.organiserData.value, groupId, updates);
  await saveData();
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { groupHasTasks } = deleteGroupService(store.organiserData.value, groupId);
  await saveData();
  if (!groupHasTasks) {
    await deleteGroupFile(groupId);
  }
}

export function getGroupsByParent(parentId?: string) {
  return getGroupsByParentUtil(store.organiserData.value.groups, parentId);
}

export const groupTree = computed(() => buildGroupTree(store.organiserData.value.groups));

export const task = boundApiTask as any;

export const group = {
  add: addGroup,
  update: updateGroup,
  delete: deleteGroup,
  getGroupsByParent,
  tree: groupTree,
};
