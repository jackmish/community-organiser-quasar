import { sanitizeConnectionDevices } from 'src/modules/lan/lanPairingRegister';
import {
  dedupeConnectedDevicesByPeerId,
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  saveConnectedDevices,
  type ConnectedDevice,
  type SaveConnectedDevicesOptions,
} from './deviceRoleAssignment';
import { patchCo21Settings } from './roleProfileSettings';

/** Load registry from disk with local device row ensured. */
export async function loadConnectionsDevices(): Promise<ConnectedDevice[]> {
  const local = await loadOwnDeviceMeta();
  const loaded = await loadConnectedDevices();
  return dedupeConnectedDevicesByPeerId(mergeLocalDeviceIntoList(loaded, local));
}

/** Persist Connections registry (never via patchCo21Settings). */
export async function saveConnectionsRegistry(
  devices: ConnectedDevice[],
  opts?: SaveConnectedDevicesOptions,
): Promise<boolean> {
  const sanitized = dedupeConnectedDevicesByPeerId(sanitizeConnectionDevices(devices));
  return saveConnectedDevices(sanitized, opts);
}

/** Backup/auto-export fields only — must not touch paired devices. */
export async function saveConnectionsBackupSettings(opts: {
  autoBackupEnabled: boolean;
  autoBackupHours: number;
  autoBackupMinutes: number;
  lastAutoBackup?: number | null;
}): Promise<boolean> {
  const patch: Record<string, unknown> = {
    autoBackupEnabled: opts.autoBackupEnabled,
    autoBackupHours: Math.floor(Number(opts.autoBackupHours) || 0),
    autoBackupMinutes: Math.floor(Number(opts.autoBackupMinutes) || 0),
  };
  if (typeof opts.lastAutoBackup === 'number' && opts.lastAutoBackup > 0) {
    patch.lastAutoBackup = opts.lastAutoBackup;
  }
  return patchCo21Settings(patch);
}
