import { loadConnectionsDevices, saveConnectionsRegistry } from './connectionsDeviceStorage';
import {
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  normalizeDeviceId,
  type ConnectedDevice,
} from './deviceRoleAssignment';
import { mergeProfilesForIncomingPreview } from './syncContractIncoming';
import { loadRoleProfiles, saveRoleProfiles } from './roleProfileSettings';
import type { SyncContractSnapshot } from './syncContractSettings';
import logger from 'src/utils/logger';

function mergeRolesByGroup(
  device: ConnectedDevice,
  snapRoles: Record<string, string> | undefined,
): ConnectedDevice {
  if (!snapRoles || !Object.keys(snapRoles).length) return device;
  return {
    ...device,
    rolesByGroup: { ...(device.rolesByGroup ?? {}), ...snapRoles },
  };
}

/**
 * Apply signed contract to local role profiles + Connections registry.
 * Incoming: peer assigns this device (local row) to groups on their organiser.
 * Outgoing finalized: restores full assignment picture including local device scope.
 */
export async function applyContractSnapshotToLocalRegistry(
  snapshot: SyncContractSnapshot,
): Promise<void> {
  const profiles = await loadRoleProfiles();
  const mergedProfiles = mergeProfilesForIncomingPreview(profiles, snapshot);
  await saveRoleProfiles(mergedProfiles);

  const local = await loadOwnDeviceMeta();
  const localNorm = normalizeDeviceId(local.id);
  const snapByNorm = new Map(
    snapshot.devices.map((d) => [normalizeDeviceId(d.id), d]),
  );

  let devices = await loadConnectionsDevices();
  devices = mergeLocalDeviceIntoList(devices, local);

  devices = devices.map((d) => {
    const snap = snapByNorm.get(normalizeDeviceId(d.id));
    if (!snap) return d;
    return mergeRolesByGroup(d, snap.rolesByGroup);
  });

  for (const snap of snapshot.devices) {
    const norm = normalizeDeviceId(snap.id);
    if (devices.some((d) => normalizeDeviceId(d.id) === norm)) continue;
    const row: ConnectedDevice = {
      id: snap.id,
      name: snap.name,
      rolesByGroup: { ...(snap.rolesByGroup ?? {}) },
    };
    if (norm === localNorm) {
      row.isLocal = true;
      row.type = 'Local';
    }
    devices.push(row);
  }

  await saveConnectionsRegistry(devices);
  window.dispatchEvent(new Event('co21:roles-saved'));
  logger.info('[syncContractApply] contract roles and profiles applied locally');
}
