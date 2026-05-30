import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';

export const PLUGINS_SYNC_CHANGED_EVENT = 'co21:plugins-sync-changed';

export async function loadPluginsSyncEnabled(): Promise<boolean> {
  const data = await loadCo21Settings();
  if (typeof data.pluginsSyncEnabled === 'boolean') return data.pluginsSyncEnabled;
  return false;
}

export async function savePluginsSyncEnabled(enabled: boolean): Promise<boolean> {
  const ok = await patchCo21Settings({ pluginsSyncEnabled: enabled });
  if (ok) {
    window.dispatchEvent(
      new CustomEvent(PLUGINS_SYNC_CHANGED_EVENT, { detail: { enabled } }),
    );
  }
  return ok;
}
