import type { LanPeerProbeResult } from './lanPeerConnectivity';
import { probeLanPeerInfo } from './lanPeerConnectivity';
import {
  dedupeConnectedDevicesByPeerId,
  normalizeDeviceId,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';

export type LanDeviceReconcileResult = {
  devices: ConnectedDevice[];
  /** Display names of rows whose id was updated from LAN /info. */
  repaired: string[];
};

const DEFAULT_RECONCILE_PROBE_MS = 2_500;

/**
 * Align stored `ConnectedDevice.id` with each peer's `/info` deviceId.
 * Wrong ids cause sync contracts to be rejected (trusted-device check).
 */
export async function reconcileLanDeviceIds(
  devices: ConnectedDevice[],
  opts?: { timeoutMs?: number; probeResults?: LanPeerProbeResult[] },
): Promise<LanDeviceReconcileResult> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_RECONCILE_PROBE_MS;
  const repaired: string[] = [];
  let next = [...devices];

  const remotes = devices.filter((d) => !d.isLocal && (d.lanHost || '').trim());
  const probes =
    opts?.probeResults ??
    (await Promise.all(remotes.map((d) => probeLanPeerInfo(d, timeoutMs))));

  for (const row of probes) {
    const d = row.device;
    const info = row.ok ? row.info : null;
    if (!info?.deviceId) continue;

    const peerNorm = normalizeDeviceId(info.deviceId);
    const storedNorm = normalizeDeviceId(d.id);
    if (peerNorm === storedNorm) continue;

    const peerId = info.deviceId.trim();
    const peerName = info.deviceName.trim();
    const existingIdx = next.findIndex(
      (x) => !x.isLocal && x.id !== d.id && normalizeDeviceId(x.id) === peerNorm,
    );
    if (existingIdx >= 0) {
      const existing = next[existingIdx]!;
      const merged: ConnectedDevice = { ...existing, id: peerId };
      if (peerName) merged.name = peerName;
      const staleHost = (d.lanHost || '').trim();
      if (!(merged.lanHost || '').trim() && staleHost) {
        merged.lanHost = staleHost;
      }
      next = next
        .filter((x) => x.id !== d.id)
        .map((x) => (x.id === existing.id ? merged : x));
      repaired.push(d.name || d.id);
      continue;
    }

    next = next.map((dev) => {
      if (dev.id !== d.id) return dev;
      const row: ConnectedDevice = { ...dev, id: peerId };
      if (peerName) row.name = peerName;
      return row;
    });
    repaired.push(d.name || d.id);
  }

  return { devices: dedupeConnectedDevicesByPeerId(next), repaired };
}
