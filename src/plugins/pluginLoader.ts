/**
 * pluginLoader.ts
 *
 * Reads the plugin manifest JSON, resolves each enabled entry to a bundled
 * (or future: external) plugin module, and merges in the mounting config.
 *
 * Returns a ready-to-register AppPlugin[] for pluginRegistry.
 *
 * Future extension point: before falling back to bundledPlugins, try loading
 * from an external path (e.g. file://%APPDATA%/community-organiser/plugins/<id>/index.js).
 */
import type { AppPlugin, PluginManifest } from './pluginTypes';
import { bundledPlugins } from './bundledPlugins';
import manifest from './plugins.manifest.json';

export async function loadPluginsFromManifest(): Promise<AppPlugin[]> {
  const { plugins } = manifest as PluginManifest;
  const enabled = plugins.filter((entry) => entry.enabled);

  const results = await Promise.allSettled(
    enabled.map(async (entry): Promise<AppPlugin> => {
      const factory = bundledPlugins[entry.id];
      if (!factory) {
        console.warn(`[plugins] No bundled plugin found for id "${entry.id}" — skipping.`);
        return { id: entry.id }; // no-op entry
      }
      const mod = await factory();
      const merged: AppPlugin = {
        ...mod.default,
        priority: entry.priority ?? 100,
        ...(entry.slot !== undefined ? { slot: entry.slot } : {}),
      };
      return merged;
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<AppPlugin> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((p) => p.piniaPlugin || p.component); // skip empty no-op entries
}
