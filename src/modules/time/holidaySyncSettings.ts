import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';

export const HOLIDAY_SYNC_CHANGED_EVENT = 'co21:holiday-sync-changed';

export async function loadHolidaySyncEnabled(): Promise<boolean> {
  const data = await loadCo21Settings();
  if (typeof data.holidaySyncEnabled === 'boolean') return data.holidaySyncEnabled;
  return true;
}

export async function saveHolidaySyncEnabled(enabled: boolean): Promise<boolean> {
  const ok = await patchCo21Settings({ holidaySyncEnabled: enabled });
  if (ok) {
    window.dispatchEvent(
      new CustomEvent(HOLIDAY_SYNC_CHANGED_EVENT, { detail: { enabled } }),
    );
  }
  return ok;
}
