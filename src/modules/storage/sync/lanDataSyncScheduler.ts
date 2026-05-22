import {
  startLanPeerReconnectScheduler,
  stopLanPeerReconnectScheduler,
} from './lanOrganiserSyncTrigger';

/** Periodic /info for offline peers; sync when connection is restored. */
export function startLanDataSyncScheduler(): void {
  startLanPeerReconnectScheduler();
}

export function stopLanDataSyncScheduler(): void {
  stopLanPeerReconnectScheduler();
}
