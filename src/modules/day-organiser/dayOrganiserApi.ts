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
import * as apiGroup from './apiGroup';
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

export const groupTree = computed(() => buildGroupTree(store.organiserData.value.groups));

const boundApiGroup = apiGroup.createGroupApi({ ...store, groupTree } as any);

export const task = boundApiTask as any;

export const group = boundApiGroup as any;
