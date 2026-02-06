import { ref, computed } from 'vue';

import type { OrganiserData } from './types';
import type { Task } from '../task/types';
import { createStorageApi } from '../storage/_apiStorage';

import { prepareGroupsForSave } from '../group/groupService';
import * as apiTask from '../task/_apiTask';
import * as apiGroup from '../group/_apiGroup';
import { createTimeApi } from '../time/_apiTime';

//// reactive state refs grouped into `state`

export const store: any = {
  // Main organiser data
  organiserData: ref<OrganiserData>({
    days: {},
    groups: [],
    lastModified: new Date().toISOString(),
  }),
  //UI control data
  // UI control data moved into the task API (keeps store focused on organiser data)
  //Shared API methods
  async saveData() {
    // call storage API bound to store
    await storage.saveData(prepareGroupsForSave(this.organiserData.value));
  },
};

// `saveData` should be called via `store.saveData()` to keep the store
// object as the canonical exported state surface.

//// API helpers
// Create and export bound APIs in a single line each for brevity
export const task = apiTask.createTaskApi(store) as any;
export const group = apiGroup.createGroupApi(store) as any;
export const time = createTimeApi() as any;
export const storage = createStorageApi(store, group) as any;
