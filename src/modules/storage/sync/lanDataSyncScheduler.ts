import { loadSyncIntervalSeconds, loadActiveContractForSync } from './syncContractSettings';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
} from './deviceRoleAssignment';
import { runSyncWithPeer } from './lanOrganiserSync';
import { findSyncPeerState } from './syncPeerState';

let timer: ReturnType<typeof setInterval> | null = null;

/** Periodic LAN data sync for paired peers when a contract is active. */
export function startLanDataSyncScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void (async () => {
      const contract = await loadActiveContractForSync();
      if (!contract) return;
      const intervalSec = await loadSyncIntervalSeconds();
      const local = await loadOwnDeviceMeta();
      const devices = mergeLocalDeviceIntoList(await loadConnectedDevices(), local);
      const remotes = devices.filter((d) => !d.isLocal && (d.lanHost || '').trim());
      const now = Date.now();
      for (const d of remotes) {
        const peer = await findSyncPeerState(d.id);
        const last = peer?.lastSyncAt ?? 0;
        if (now - last < intervalSec * 1000) continue;
        await runSyncWithPeer({
          peerDeviceId: d.id,
          peerDeviceName: d.name,
          lanHost: (d.lanHost || '').trim(),
        });
      }
    })();
  }, 15_000);
}

export function stopLanDataSyncScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
