/**
 * taskStats plugin entry point.
 *
 * Exports only functional parts — no slot or priority here.
 * Mounting config (slot, priority, enabled) lives in plugins.manifest.json.
 */
import type { AppPluginModule } from '../pluginTypes';
import { taskStatsPiniaPlugin } from './piniaPlugin';
import TaskStatsBar from './TaskStatsBar.vue';

const plugin: AppPluginModule = {
  id: 'taskStats',
  piniaPlugin: taskStatsPiniaPlugin,
  component: TaskStatsBar,
};

export default plugin;
