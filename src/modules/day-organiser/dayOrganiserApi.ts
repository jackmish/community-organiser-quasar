import { ref, computed } from 'vue';

import type { OrganiserData } from './types';
import type { Task } from '../task/types';
import { storage } from './storage';

import { prepareGroupsForSave } from '../group/groupService';
import * as apiTask from './apiTask';
import * as apiGroup from './apiGroup';

//// reactive state refs grouped into `state`

export const store: any = {
  // Main organiser data
  organiserData: ref<OrganiserData>({
    days: {},
    groups: [],
    lastModified: new Date().toISOString(),
  }),
  //UI control data
  currentDate: ref<string>(new Date().toISOString().split('T')[0] ?? ''),
  previewTaskId: ref<string | null>(null),
  previewTaskPayload: ref<Task | null>(null),
  activeGroup: ref<{ label: string; value: string | null } | null>(null),
  //Shared API methods
  async saveData() {
    const dataToSave = prepareGroupsForSave(this.organiserData.value);
    await storage.saveData(dataToSave);
  },
};

// `saveData` should be called via `store.saveData()` to keep the store
// object as the canonical exported state surface.

//// API helpers
// Create and export bound APIs in a single line each for brevity
export const task = apiTask.createTaskApi(store) as any;
export const group = apiGroup.createGroupApi(store) as any;
