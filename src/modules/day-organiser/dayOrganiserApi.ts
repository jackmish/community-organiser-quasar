import { ref, computed } from 'vue';

import type { OrganiserData } from './types';
import { storage } from './storage';

import { prepareGroupsForSave } from '../group/groupService';
import { buildGroupTree } from '../group/groupUtils';
import * as apiTask from './apiTask';
import * as apiGroup from './apiGroup';
import type { Task } from '../task/types';

export type PreviewPayload = string | number | Task | null;

//// reactive state refs grouped into `state`
const organiserData = ref<OrganiserData>({
  days: {},
  groups: [],
  lastModified: new Date().toISOString(),
});

export const store: any = {
  organiserData,
  currentDate: ref<string>(new Date().toISOString().split('T')[0] ?? ''),
  previewTaskId: ref<string | null>(null),
  previewTaskPayload: ref<Task | null>(null),
  activeGroup: ref<{ label: string; value: string | null } | null>(null),
  groupTree: computed(() => buildGroupTree(organiserData.value.groups)),
  async saveData() {
    const dataToSave = prepareGroupsForSave(organiserData.value);
    await storage.saveData(dataToSave);
  },
};

//// API helpers
// Create and export bound APIs in a single line each for brevity
export const task = apiTask.createTaskApi(store) as any;
export const group = apiGroup.createGroupApi(store) as any;
