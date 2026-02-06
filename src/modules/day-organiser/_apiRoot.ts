import { createStorageApi } from '../storage/_apiStorage';
import { registerAppService } from 'src/services/appService';

import * as apiTask from '../task/_apiTask';
import * as apiGroup from '../group/_apiGroup';
import { createTimeApi } from '../time/_apiTime';

// Available APIs for external use (e.g. by components or other modules)
export const time = createTimeApi() as any;

// Configure taskService default days getter so taskService can operate without
// callers passing the days map explicitly.

// taskService default days getter is wired when storage/time initializes.

// Create APIs without passing a legacy `store` object. Storage will be
// created and then wired to other APIs via their internal setters.
export const group = apiGroup.createGroupApi() as any;
// taskService reads `time` directly; no runtime wiring required here.
export const task = apiTask.createTaskApi(group, time) as any;
export const storage = createStorageApi(group, time) as any;

// register storage as a global app service for other modules to use
try {
  registerAppService('storage', storage);
} catch (e) {
  void e;
}
