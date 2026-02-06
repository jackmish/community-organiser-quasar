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
  // Legacy organiserData removed — use `time` and `group` APIs instead.
  // Shared API methods
  async saveData() {
    // storage.saveData will build payload from refactored APIs if none provided
    await storage.saveData();
  },
};

// `saveData` should be called via `store.saveData()` to keep the store
// object as the canonical exported state surface.

//// API helpers
// Create and export bound APIs in a single line each for brevity
export const time = createTimeApi() as any;
export const group = apiGroup.createGroupApi(store) as any;
export const task = apiTask.createTaskApi(store, group, time) as any;
export const storage = createStorageApi(store, group, time) as any;
