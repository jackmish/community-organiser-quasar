import * as apiStorage from '../storage/_apiStorage';
import { registerAppService } from 'src/services/appService';

import * as apiTask from '../task/_apiTask';
import * as apiGroup from '../group/_apiGroup';
import * as apiTime from '../time/_apiTime';

// Available APIs for external use (e.g. by components or other modules)
export const time = apiTime.construct() as any;
export const group = apiGroup.construct() as any;
export const task = apiTask.construct(group, time) as any;
export const storage = apiStorage.construct(group, time) as any;

// register storage to avoid construction order issues (e.g. with taskService which needs timeApi.days populated by storage)
try {
  registerAppService('storage', storage);
} catch (e) {
  void e;
}
