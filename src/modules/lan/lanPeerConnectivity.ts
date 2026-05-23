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
import {
  listCandidateHostsForDevice,
  patchPeerLanHostInConnections,
  prepareRemotesForLanOps,
  rememberPeerLanHost,
} from './lanRemoteHost';
import { isLanDebugCaptureActive, lanDebugNote } from './lanDebugLog';

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
  const candidates = await listCandidateHostsForDevice(device);
  const now = Date.now();
  const prior = await findSyncPeerState(device.id);
  const wasConnected = prior?.peerInRange === true;

  if (isLanDebugCaptureActive()) {
    lanDebugNote(
      `Probe ${device.name}`,
      candidates.length
        ? `Trying hosts: ${candidates.join(', ')}`
        : 'No LAN host candidates (pair again or set IP in Connections)',
    );
  }

  if (!candidates.length) {
    await upsertSyncPeerState({
      peerDeviceId: device.id,
      peerDeviceName: device.name,
      peerInRange: false,
      peerCheckedAt: now,
    });
    return { device, ok: false, info: null, reconnected: false };
  }

  for (const lanHost of candidates) {
    const base = co21LanBaseUrl(lanHost);
    if (!base) continue;
    try {
      const info = await lanFetchInfo(base, { timeoutMs });
      const ok = !!info?.deviceId;
      if (!ok) {
        if (isLanDebugCaptureActive()) {
          lanDebugNote(`/info failed`, `No deviceId from ${lanHost}`);
        }
        continue;
      }
      if (isLanDebugCaptureActive()) {
        lanDebugNote(`Probe OK`, `${device.name} reachable at ${lanHost}`);
      }
      await rememberPeerLanHost(device.id, lanHost);
      await patchPeerLanHostInConnections(device.id, lanHost);
      const resolvedDevice = { ...device, lanHost };
      await upsertSyncPeerState({
        peerDeviceId: device.id,
        peerDeviceName: device.name,
        peerInRange: true,
        peerCheckedAt: now,
      });
      return {
        device: resolvedDevice,
        ok: true,
        info,
        reconnected: !wasConnected,
      };
    } catch (e: unknown) {
      if (isLanDebugCaptureActive()) {
        const msg = e instanceof Error ? e.message : String(e);
        lanDebugNote(`/info error`, `${lanHost}: ${msg}`);
      }
    }
  }

  if (isLanDebugCaptureActive()) {
    lanDebugNote(`Probe failed`, `${device.name}: none of ${candidates.length} host(s) answered`);
  }

  await upsertSyncPeerState({
    peerDeviceId: device.id,
    peerDeviceName: device.name,
    peerInRange: false,
    peerCheckedAt: now,
    lastSyncMessage: 'info_unreachable',
  });
  return { device, ok: false, info: null, reconnected: false };
}

/** Parallel /info for all remotes (startup or full refresh). */
export async function probeAllLanPeers(
  timeoutMs = LAN_INFO_PROBE_MS,
): Promise<LanPeerProbeResult[]> {
  const remotes = await prepareRemotesForLanOps({ persistHosts: true });
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
