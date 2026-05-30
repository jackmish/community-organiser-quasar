import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';

export const CLOCK_SYNC_CHANGED_EVENT = 'co21:clock-sync-changed';

export async function loadClockSyncEnabled(): Promise<boolean> {
  const data = await loadCo21Settings();
  if (typeof data.clockSyncEnabled === 'boolean') return data.clockSyncEnabled;
  return true;
}

export async function saveClockSyncEnabled(enabled: boolean): Promise<boolean> {
  const ok = await patchCo21Settings({ clockSyncEnabled: enabled });
  if (ok) {
    window.dispatchEvent(
      new CustomEvent(CLOCK_SYNC_CHANGED_EVENT, { detail: { enabled } }),
    );
  }
  return ok;
}
