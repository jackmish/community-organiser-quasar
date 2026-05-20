import { refreshLanServerForConnections } from './lanServerManager';
import { isUsableLanHost, pickReachableLanHost } from './lanPairingHosts';
import type { LanPairedDevicePayload } from './lanPairingUi';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  normalizeDeviceId,
  parseConnectedDevice,
  saveConnectedDevices,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { loadCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import { DEFAULT_SYNC_INTERVAL_SECONDS } from 'src/modules/storage/sync/syncContractSettings';

/** Drop bogus rows saved from loopback pairing (not this device's local row). */
export function sanitizeConnectionDevices(devices: ConnectedDevice[]): ConnectedDevice[] {
  return devices.filter((d) => {
    if (d.isLocal) return true;
    const name = String(d.name || '').trim().toLowerCase();
    const host = String(d.lanHost || '').trim();
    if (name === 'localhost' && !isUsableLanHost(host)) return false;
    if (host && !isUsableLanHost(host)) return false;
    return true;
  });
}

/** Add or update a LAN peer after pairing (both initiator and acceptor). */
export async function persistPairedLanDevice(payload: LanPairedDevicePayload): Promise<void> {
  const lanHost = pickReachableLanHost([payload.lanHost]);
  const local = await loadOwnDeviceMeta();
  const loaded = await loadConnectedDevices();
  let devices = sanitizeConnectionDevices(mergeLocalDeviceIntoList(loaded, local));
  const peerNorm = normalizeDeviceId(payload.id);
  const idx = devices.findIndex(
    (d) => !d.isLocal && normalizeDeviceId(d.id) === peerNorm,
  );
  const row: ConnectedDevice = {
    id: payload.id,
    name: payload.name || payload.id,
    type: payload.type || 'LAN',
    syncIntervalSeconds: DEFAULT_SYNC_INTERVAL_SECONDS,
    ...(lanHost ? { lanHost } : {}),
  };
  if (idx >= 0) {
    const prev = devices[idx]!;
    const updated: ConnectedDevice = { ...prev, ...row };
    devices = devices.map((d, i) => (i === idx ? updated : d));
  } else {
    devices = [...devices, row];
  }
  await saveConnectedDevices(devices);
  const settings = await loadCo21Settings();
  const ownName =
    typeof settings.ownDeviceName === 'string' && settings.ownDeviceName.trim()
      ? settings.ownDeviceName.trim()
      : local.name;
  await refreshLanServerForConnections(devices, ownName);
}

export function parseDevicesFromSettingsJson(
  raw: unknown,
): ConnectedDevice[] {
  if (!Array.isArray(raw)) return [];
  return sanitizeConnectionDevices(
    raw.map((d) => parseConnectedDevice(d as Record<string, unknown>)),
  );
}
