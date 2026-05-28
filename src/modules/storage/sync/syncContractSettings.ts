import { patchCo21Settings, loadCo21Settings } from './roleProfileSettings';
import { getSyncContractRuntime, setSyncContractRuntime } from './syncContractRuntime';

export const DEFAULT_SYNC_INTERVAL_SECONDS = 60;
export const MIN_SYNC_INTERVAL_SECONDS = 15;
export const MAX_SYNC_INTERVAL_SECONDS = 3600;

/** How group/task duplicates are resolved during sync. */
export type SyncDuplicateResolution = 'auto' | 'manual';

export const DEFAULT_SYNC_DUPLICATE_RESOLUTION: SyncDuplicateResolution = 'auto';

export type SyncContractSnapshot = {
  savedAt: number;
  /** Group/task duplicate handling for this contract (default auto). */
  duplicateResolution?: SyncDuplicateResolution;
  devices: Array<{ id: string; name: string; rolesByGroup: Record<string, string> }>;
  roleProfiles: Array<{
    id: string;
    name: string;
    accessRange: string;
    updatedAt: number;
    functionAccess: Array<{ functionId: string; enabled: boolean; privilege: string }>;
  }>;
  /** Group metadata for display on the receiving device (optional, backward-compat). */
  groups?: Array<{
    id: string;
    name: string;
    icon?: string;
    color?: string;
    textColor?: string;
    parentId?: string | null;
    taskCount?: number;
  }>;
};

export type SyncContractPending = {
  createdAt: number;
  snapshot: SyncContractSnapshot;
  /** Device id that proposed this contract (local). */
  proposerDeviceId: string;
  proposerDeviceName: string;
  /** Shared rotating-token seed for LAN data sync (proposer generates). */
  syncSessionToken?: string;
  /** LAN host of proposer when known (for reject notify-back). */
  proposerLanHost?: string;
  /** Agreed sync interval (seconds) — included when peer is offline. */
  intervalSeconds?: number;
  duplicateResolution?: SyncDuplicateResolution;
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

export async function loadSyncDuplicateResolution(): Promise<SyncDuplicateResolution> {
  const data = await loadCo21Settings();
  const v = data.syncDuplicateResolution;
  return v === 'manual' ? 'manual' : DEFAULT_SYNC_DUPLICATE_RESOLUTION;
}

export async function saveSyncDuplicateResolution(
  mode: SyncDuplicateResolution,
): Promise<boolean> {
  return patchCo21Settings({
    syncDuplicateResolution: mode === 'manual' ? 'manual' : DEFAULT_SYNC_DUPLICATE_RESOLUTION,
  });
}

export function normalizeSyncDuplicateResolution(
  v: unknown,
): SyncDuplicateResolution {
  return v === 'manual' ? 'manual' : DEFAULT_SYNC_DUPLICATE_RESOLUTION;
}

export async function loadLastContractSnapshot(): Promise<SyncContractSnapshot | null> {
  const data = await loadCo21Settings();
  const raw = data.syncLastContractSnapshot;
  if (!raw || typeof raw !== 'object') return null;
  return raw as SyncContractSnapshot;
}

export function snapshotFromPending(pending: SyncContractPending): SyncContractSnapshot {
  const snap = pending.snapshot;
  const dup =
    pending.duplicateResolution ?? snap.duplicateResolution ?? DEFAULT_SYNC_DUPLICATE_RESOLUTION;
  return {
    ...snap,
    duplicateResolution: dup,
    savedAt: typeof snap.savedAt === 'number' && snap.savedAt > 0 ? snap.savedAt : pending.createdAt,
  };
}

/**
 * Contract terms for LAN data sync: signed snapshot, or pending outgoing/incoming proposal.
 * Avoids `no_contract` when one side has queued/sent a contract but not yet `syncLastContractSnapshot`.
 */
export async function loadActiveContractForSync(): Promise<SyncContractSnapshot | null> {
  const runtime = getSyncContractRuntime();
  if (runtime) return runtime;
  const last = await loadLastContractSnapshot();
  if (last) return last;
  const incoming = await loadPendingIncomingContract();
  if (incoming?.snapshot) return snapshotFromPending(incoming);
  const outgoing = await loadPendingOutgoingContract();
  if (outgoing?.snapshot) return snapshotFromPending(outgoing);
  return null;
}

export async function saveLastContractSnapshot(snapshot: SyncContractSnapshot): Promise<boolean> {
  setSyncContractRuntime(snapshot);
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
  if (pending?.snapshot) {
    setSyncContractRuntime(snapshotFromPending(pending));
  }
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
  if (pending?.snapshot) {
    setSyncContractRuntime(snapshotFromPending(pending));
  }
  return patchCo21Settings({
    syncPendingIncomingContract: pending ?? null,
  });
}

export async function isSyncContractActive(): Promise<boolean> {
  const data = await loadCo21Settings();
  return typeof data.syncContractAcceptedAt === 'number' && data.syncContractAcceptedAt > 0;
}

/** Remove signed contract from disk and runtime (pending queues handled separately). */
export async function clearSignedSyncContract(): Promise<boolean> {
  setSyncContractRuntime(null);
  return patchCo21Settings({
    syncLastContractSnapshot: null,
    syncContractAcceptedAt: null,
  });
}
