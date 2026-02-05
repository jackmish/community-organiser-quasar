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
export const state = {
  organiserData: ref<OrganiserData>({
    days: {},
    groups: [],
    lastModified: new Date().toISOString(),
  }),
  currentDate: ref<string>(new Date().toISOString().split('T')[0] ?? ''),
  previewTaskId: ref<string | null>(null),
  previewTaskPayload: ref<Task | null>(null),
  activeGroup: ref<{ label: string; value: string | null } | null>(null),
};

//// API functions
export async function saveData() {
  const dataToSave = prepareGroupsForSave(state.organiserData.value);
  await storage.saveData(dataToSave);
}

// Create a bound task API using the factory from apiTask and provide a preview setter
const boundApiTask = apiTask.createTaskApi(state, saveData);

// Group management helpers
export async function addGroup(groupInput: CreateGroupInput) {
  const group = addGroupService(state.organiserData.value, groupInput);
  await saveData();
  return group;
}

export async function updateGroup(groupId: string, updates: Partial<any>): Promise<void> {
  updateGroupService(state.organiserData.value, groupId, updates);
  await saveData();
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { groupHasTasks } = deleteGroupService(state.organiserData.value, groupId);
  await saveData();
  if (!groupHasTasks) {
    await deleteGroupFile(groupId);
  }
}

export function getGroupsByParent(parentId?: string) {
  return getGroupsByParentUtil(state.organiserData.value.groups, parentId);
}

export const groupTree = computed(() => buildGroupTree(state.organiserData.value.groups));

export const task = boundApiTask as any;

export const group = {
  add: addGroup,
  update: updateGroup,
  delete: deleteGroup,
  getGroupsByParent,
  tree: groupTree,
};
