import { co21LanBaseUrl } from './lanPairingConstants';
import { lanFetchInfo } from './lanPairingClient';
import {
  normalizeDeviceId,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';

export type LanDeviceReconcileResult = {
  devices: ConnectedDevice[];
  /** Display names of rows whose id was updated from LAN /info. */
  repaired: string[];
};

/**
 * Align stored `ConnectedDevice.id` with each peer's `/info` deviceId.
 * Wrong ids cause sync contracts to be rejected (trusted-device check).
 */
export async function reconcileLanDeviceIds(
  devices: ConnectedDevice[],
): Promise<LanDeviceReconcileResult> {
  const repaired: string[] = [];
  let next = [...devices];

  for (const d of devices) {
    if (d.isLocal) continue;
    const host = (d.lanHost || '').trim();
    if (!host) continue;
    const base = co21LanBaseUrl(host);
    if (!base) continue;

    let info: Awaited<ReturnType<typeof lanFetchInfo>> = null;
    try {
      info = await lanFetchInfo(base, { timeoutMs: 5000 });
    } catch {
      continue;
    }
    if (!info?.deviceId) continue;

    const peerNorm = normalizeDeviceId(info.deviceId);
    const storedNorm = normalizeDeviceId(d.id);
    if (peerNorm === storedNorm) continue;

    const duplicate = next.some(
      (x) => !x.isLocal && x.id !== d.id && normalizeDeviceId(x.id) === peerNorm,
    );
    if (duplicate) continue;

    const peerId = info.deviceId.trim();
    const peerName = info.deviceName.trim();
    next = next.map((dev) => {
      if (dev.id !== d.id) return dev;
      const row: ConnectedDevice = { ...dev, id: peerId };
      if (peerName) row.name = peerName;
      return row;
    });
    repaired.push(d.name || d.id);
  }

  return { devices: next, repaired };
}
