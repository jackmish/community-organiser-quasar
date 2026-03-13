import type { Component } from 'vue';
import type { PiniaPlugin } from 'pinia';

/**
 * What a plugin module exports from its index.ts.
 * Purely functional — no mounting config (slot/priority) here.
 */
export interface AppPluginModule {
  id: string;
  piniaPlugin?: PiniaPlugin;
  component?: Component;
}

/**
 * A plugin entry after merging the module with its manifest config.
 * This is what pluginRegistry holds at runtime.
 */
export interface AppPlugin extends AppPluginModule {
  /** Lower number = loads/renders first. Default 100. */
  priority?: number;
  /** Name of the <PluginSlot> mount point in a template. */
  slot?: string;
}

/** Shape of a single entry inside plugins.manifest.json */
export interface PluginManifestEntry {
  id: string;
  enabled: boolean;
  priority?: number;
  slot?: string;
}

/** Shape of the full plugins.manifest.json file */
export interface PluginManifest {
  version: string;
  plugins: PluginManifestEntry[];
}
