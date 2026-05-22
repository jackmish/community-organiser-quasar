import { isPresentationModeActive } from 'src/composables/usePresentationGuard';
import { loadActiveContractForSync } from './syncContractSettings';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
} from './deviceRoleAssignment';
import { runSyncWithPeer } from './lanOrganiserSync';

/** Debounce rapid edits (preview priority, line edits) into one exchange per peer. */
const DEBOUNCE_MS = 600;

let suppressCount = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncRunning = false;
let runAgainAfterCurrent = false;

export function suppressOrganiserSyncTrigger(): void {
  suppressCount += 1;
}

export function releaseOrganiserSyncTrigger(): void {
  suppressCount = Math.max(0, suppressCount - 1);
}

export async function withOrganiserSyncTriggerSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressOrganiserSyncTrigger();
  try {
    return await fn();
  } finally {
    releaseOrganiserSyncTrigger();
  }
}

/** Queue LAN `/sync/exchange` with all paired peers (after local organiser data changed). */
export function scheduleLanSyncAfterOrganiserChange(): void {
  if (suppressCount > 0) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runLanSyncForAllPeers();
  }, DEBOUNCE_MS);
}

/** Await LAN exchange with all peers before showing the organiser task list (app launch). */
export async function runLanSyncBeforeOrganiserDisplay(): Promise<void> {
  if (isPresentationModeActive()) return;
  if (!(window as Window & { electronLan?: unknown }).electronLan) return;
  await withOrganiserSyncTriggerSuppressed(async () => {
    await runLanSyncForAllPeers();
  });
}

export async function runLanSyncForAllPeersNow(): Promise<void> {
  await runLanSyncForAllPeers();
}

async function runLanSyncForAllPeers(): Promise<void> {
  if (syncRunning) {
    runAgainAfterCurrent = true;
    return;
  }
  syncRunning = true;
  try {
    const contract = await loadActiveContractForSync();
    if (!contract) return;

    const local = await loadOwnDeviceMeta();
    const devices = mergeLocalDeviceIntoList(await loadConnectedDevices(), local);
    const remotes = devices.filter((d) => !d.isLocal && (d.lanHost || '').trim());

    for (const d of remotes) {
      await runSyncWithPeer({
        peerDeviceId: d.id,
        peerDeviceName: d.name,
        lanHost: (d.lanHost || '').trim(),
      });
    }
  } finally {
    syncRunning = false;
    if (runAgainAfterCurrent) {
      runAgainAfterCurrent = false;
      scheduleLanSyncAfterOrganiserChange();
    }
  }
}
