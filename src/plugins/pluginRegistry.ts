/**
 * Plugin registry
 *
 * Holds the list of registered AppPlugin entries and provides helpers for
 * the boot file and PluginSlot component to consume them.
 *
 * Nothing in the core app imports individual plugins — they go through here.
 */
import type { AppPlugin } from './pluginTypes';
import type { PiniaPlugin } from 'pinia';

let _plugins: AppPlugin[] = [];

/** Called once from boot after the config is imported. */
export function registerPlugins(plugins: AppPlugin[]) {
  _plugins = [...plugins].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

/** Returns all Pinia plugins, in priority order, for registration at boot. */
export function getPiniaPlugins(): PiniaPlugin[] {
  return _plugins.filter((p) => p.piniaPlugin).map((p) => p.piniaPlugin!);
}

/**
 * Returns all Vue components registered for a given slot name,
 * sorted by priority. Used by <PluginSlot>.
 */
export function getSlotComponents(slot: string) {
  return _plugins.filter((p) => p.slot === slot && p.component).map((p) => p.component!);
}
