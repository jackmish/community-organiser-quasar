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
  const dataToSave = prepareGroupsForSave(organiserData.value);
  await storage.saveData(dataToSave);
}

// Create a bound task API using the factory from apiTask and provide a preview setter
const boundApiTask = apiTask.createTaskApi(
  () => organiserData.value,
  saveData,
  (payload) => {
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
    const p = payload as Record<string, any>;
    const pid = p['id'];
    previewTaskId.value = typeof pid === 'string' || typeof pid === 'number' ? String(pid) : null;
    previewTaskPayload.value = p;
  },
);

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
    await deleteGroupFile(groupId);
  }
}

export function getGroupsByParent(parentId?: string) {
  return getGroupsByParentUtil(organiserData.value.groups, parentId);
}

export const groupTree = computed(() => buildGroupTree(organiserData.value.groups));

export const task = boundApiTask as any;

export const group = {
  add: addGroup,
  update: updateGroup,
  delete: deleteGroup,
  getGroupsByParent,
  tree: groupTree,
};
