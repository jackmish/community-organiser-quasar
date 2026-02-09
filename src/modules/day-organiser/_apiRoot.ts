import * as apiStorage from '../storage/_apiStorage';
import { registerAppService } from 'src/services/appService';

import * as apiTask from '../task/_apiTask';
import * as apiGroup from '../group/_apiGroup';
// Available APIs for external use (e.g. by components or other modules)
export const group = apiGroup.construct() as any;
export const task = apiTask.construct(group) as any;
export const storage = apiStorage.construct(group, task.time) as any;

// register storage to avoid construction order issues (e.g. with taskService which needs timeApi.days populated by storage)
try {
  registerAppService('storage', storage);
} catch (e) {
  void e;
}
