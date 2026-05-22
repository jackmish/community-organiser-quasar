import { co21LanBaseUrl } from './lanPairingConstants';
import { lanFetchInfo } from './lanPairingClient';
import type { LanPeerInfo } from './lanPairingClient';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { findSyncPeerState, upsertSyncPeerState } from 'src/modules/storage/sync/syncPeerState';

/** GET /info — sole check that a peer is reachable before any sync exchange. */
export const LAN_INFO_PROBE_MS = 2_500;

export type LanPeerProbeResult = {
  device: ConnectedDevice;
  ok: boolean;
  info: LanPeerInfo | null;
  /** Peer was offline (or unknown) and this probe succeeded. */
  reconnected: boolean;
};

export async function listRemoteLanDevices(): Promise<ConnectedDevice[]> {
  const local = await loadOwnDeviceMeta();
  const devices = mergeLocalDeviceIntoList(await loadConnectedDevices(), local);
  return devices.filter((d) => !d.isLocal && (d.lanHost || '').trim());
}

/**
 * Single /info request; updates {@link SyncPeerRecord.peerInRange}.
 * No retries — caller may poll on an interval when offline.
 */
export async function probeLanPeerInfo(
  device: ConnectedDevice,
  timeoutMs = LAN_INFO_PROBE_MS,
): Promise<LanPeerProbeResult> {
  const lanHost = (device.lanHost || '').trim();
  const base = co21LanBaseUrl(lanHost);
  const now = Date.now();
  const prior = await findSyncPeerState(device.id);
  const wasConnected = prior?.peerInRange === true;

  if (!base) {
    await upsertSyncPeerState({
      peerDeviceId: device.id,
      peerDeviceName: device.name,
      peerInRange: false,
      peerCheckedAt: now,
    });
    return { device, ok: false, info: null, reconnected: false };
  }

  try {
    const info = await lanFetchInfo(base, { timeoutMs });
    const ok = !!info?.deviceId;
    await upsertSyncPeerState({
      peerDeviceId: device.id,
      peerDeviceName: device.name,
      peerInRange: ok,
      peerCheckedAt: now,
      ...(ok ? {} : { lastSyncMessage: 'info_unreachable' }),
    });
    return {
      device,
      ok,
      info: ok ? info : null,
      reconnected: ok && !wasConnected,
    };
  } catch {
    await upsertSyncPeerState({
      peerDeviceId: device.id,
      peerDeviceName: device.name,
      peerInRange: false,
      peerCheckedAt: now,
      lastSyncMessage: 'info_unreachable',
    });
    return { device, ok: false, info: null, reconnected: false };
  }
}

/** Parallel /info for all remotes (startup or full refresh). */
export async function probeAllLanPeers(
  timeoutMs = LAN_INFO_PROBE_MS,
): Promise<LanPeerProbeResult[]> {
  const remotes = await listRemoteLanDevices();
  if (!remotes.length) return [];
  return Promise.all(remotes.map((d) => probeLanPeerInfo(d, timeoutMs)));
}

/** Peers that answered /info on the last probe. */
export async function listLanPeersConfirmedByInfo(): Promise<ConnectedDevice[]> {
  const remotes = await listRemoteLanDevices();
  const out: ConnectedDevice[] = [];
  for (const d of remotes) {
    const state = await findSyncPeerState(d.id);
    if (state?.peerInRange === true) out.push(d);
  }
  return out;
}
