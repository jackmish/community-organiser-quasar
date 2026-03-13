/**
 * bundledPlugins.ts
 *
 * Maps plugin IDs to their dynamic import factories.
 * This is the only file that knows about specific bundled plugin modules.
 *
 * To add a new bundled plugin, add one line here.
 * Nothing else in core needs to change.
 */
import type { AppPluginModule } from './pluginTypes';

type PluginFactory = () => Promise<{ default: AppPluginModule }>;

export const bundledPlugins: Record<string, PluginFactory> = {
  taskStats: () => import('./taskStats/index'),
};
