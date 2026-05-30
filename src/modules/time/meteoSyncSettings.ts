import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';

export const METEO_SYNC_CHANGED_EVENT = 'co21:meteo-sync-changed';

export async function loadMeteoSyncEnabled(): Promise<boolean> {
  const data = await loadCo21Settings();
  if (typeof data.meteoSyncEnabled === 'boolean') return data.meteoSyncEnabled;
  return false;
}

export async function saveMeteoSyncEnabled(enabled: boolean): Promise<boolean> {
  const ok = await patchCo21Settings({ meteoSyncEnabled: enabled });
  if (ok) {
    window.dispatchEvent(
      new CustomEvent(METEO_SYNC_CHANGED_EVENT, { detail: { enabled } }),
    );
  }
  return ok;
}
