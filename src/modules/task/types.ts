// Re-export TaskModel under the legacy name `Task` so all existing
// imports of `Task` from this file continue to work without changes.
// Prefer importing `TaskModel` directly from './TaskModel' in new code.
export { TaskModel, TaskModel as Task } from './models/TaskModel';
export type { TaskDuration } from './models/TaskModel';

import type { Group } from '../group/models/GroupModel';
export type { Group };

// DayData and OrganiserData moved to `src/modules/day-organiser/types.ts`
