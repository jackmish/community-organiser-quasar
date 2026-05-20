import { patchCo21Settings, loadCo21Settings } from './roleProfileSettings';

export const DEFAULT_SYNC_INTERVAL_SECONDS = 60;
export const MIN_SYNC_INTERVAL_SECONDS = 15;
export const MAX_SYNC_INTERVAL_SECONDS = 3600;

export type SyncContractSnapshot = {
  savedAt: number;
  devices: Array<{ id: string; name: string; rolesByGroup: Record<string, string> }>;
  roleProfiles: Array<{
    id: string;
    name: string;
    accessRange: string;
    updatedAt: number;
    functionAccess: Array<{ functionId: string; enabled: boolean; privilege: string }>;
  }>;
};

export type SyncContractPending = {
  createdAt: number;
  snapshot: SyncContractSnapshot;
  /** Device id that proposed this contract (local). */
  proposerDeviceId: string;
  proposerDeviceName: string;
};

export async function loadSyncIntervalSeconds(): Promise<number> {
  const data = await loadCo21Settings();
  const n = data.syncIntervalSeconds;
  if (typeof n === 'number' && n >= MIN_SYNC_INTERVAL_SECONDS && n <= MAX_SYNC_INTERVAL_SECONDS) {
    return Math.floor(n);
  }
  return DEFAULT_SYNC_INTERVAL_SECONDS;
}

export async function saveSyncIntervalSeconds(seconds: number): Promise<boolean> {
  const v = Math.min(
    MAX_SYNC_INTERVAL_SECONDS,
    Math.max(MIN_SYNC_INTERVAL_SECONDS, Math.floor(seconds)),
  );
  return patchCo21Settings({ syncIntervalSeconds: v });
}

export async function loadLastContractSnapshot(): Promise<SyncContractSnapshot | null> {
  const data = await loadCo21Settings();
  const raw = data.syncLastContractSnapshot;
  if (!raw || typeof raw !== 'object') return null;
  return raw as SyncContractSnapshot;
}

export async function saveLastContractSnapshot(snapshot: SyncContractSnapshot): Promise<boolean> {
  return patchCo21Settings({
    syncLastContractSnapshot: snapshot,
    syncContractAcceptedAt: Date.now(),
  });
}

export async function loadPendingOutgoingContract(): Promise<SyncContractPending | null> {
  const data = await loadCo21Settings();
  const raw = data.syncPendingOutgoingContract;
  if (!raw || typeof raw !== 'object') return null;
  return raw as SyncContractPending;
}

export async function savePendingOutgoingContract(
  pending: SyncContractPending | null,
): Promise<boolean> {
  return patchCo21Settings({
    syncPendingOutgoingContract: pending ?? null,
  });
}

export async function loadPendingIncomingContract(): Promise<SyncContractPending | null> {
  const data = await loadCo21Settings();
  const raw = data.syncPendingIncomingContract;
  if (!raw || typeof raw !== 'object') return null;
  return raw as SyncContractPending;
}

export async function savePendingIncomingContract(
  pending: SyncContractPending | null,
): Promise<boolean> {
  return patchCo21Settings({
    syncPendingIncomingContract: pending ?? null,
  });
}

export async function isSyncContractActive(): Promise<boolean> {
  const data = await loadCo21Settings();
  return typeof data.syncContractAcceptedAt === 'number' && data.syncContractAcceptedAt > 0;
}
