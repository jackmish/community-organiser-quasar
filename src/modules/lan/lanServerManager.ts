import { deviceId } from 'src/modules/storage/sync/deviceId';
import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import {
  saveConnectedDevices,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { reconcileLanDeviceIds } from './lanDeviceReconcile';
import logger from 'src/utils/logger';

type ElectronLan = {
  startServer?: (identity: {
    deviceId: string;
    deviceName: string;
    appVersion: string;
  }) => Promise<{ ok?: boolean; error?: string; addresses?: string[] }>;
  stopServer?: () => Promise<unknown>;
  status?: () => Promise<{ listening?: boolean; addresses?: string[] }>;
  setTrustedContractDevices?: (ids: string[]) => Promise<unknown>;
};

function electronLan(): ElectronLan | undefined {
  return (window as Window & { electronLan?: ElectronLan }).electronLan;
}

/** Default on: keep LAN server ready for sync contracts from paired devices. */
export async function loadLanAutoListen(): Promise<boolean> {
  const data = await loadCo21Settings();
  return data.lanAutoListen !== false;
}

export async function saveLanAutoListen(enabled: boolean): Promise<boolean> {
  return patchCo21Settings({ lanAutoListen: enabled });
}

export function registeredRemoteDeviceIds(devices: ConnectedDevice[]): string[] {
  return devices.filter((d) => !d.isLocal && d.id).map((d) => d.id);
}

/** Tell main process which device ids may POST sync contracts (empty = allow any). */
export async function syncLanTrustedContractDevices(devices: ConnectedDevice[]): Promise<void> {
  const elan = electronLan();
  if (!elan?.setTrustedContractDevices) return;
  const ids = registeredRemoteDeviceIds(devices);
  try {
    await elan.setTrustedContractDevices(ids);
  } catch (e) {
    logger.warn('[lanServerManager] setTrustedContractDevices failed', e);
  }
}

export async function isLanServerListening(): Promise<boolean> {
  const elan = electronLan();
  if (!elan?.status) return false;
  try {
    const s = await elan.status();
    return !!s?.listening;
  } catch {
    return false;
  }
}

/**
 * Start LAN HTTP server if auto-listen is enabled (Electron only).
 * Required for receiving pairing requests and sync contracts.
 */
export async function ensureLanServerForSync(
  ownDeviceName: string,
  opts?: { force?: boolean },
): Promise<{ listening: boolean; error?: string }> {
  const elan = electronLan();
  if (!elan?.startServer) {
    return { listening: false, error: 'not_electron' };
  }

  if (await isLanServerListening()) {
    return { listening: true };
  }

  const autoListen = opts?.force ? true : await loadLanAutoListen();
  if (!autoListen) {
    return { listening: false, error: 'auto_listen_disabled' };
  }

  try {
    const id = await deviceId.get();
    const ver =
      typeof (window as Window & { APP_VERSION?: string }).APP_VERSION === 'string'
        ? String((window as Window & { APP_VERSION?: string }).APP_VERSION)
        : '';
    const name = (ownDeviceName || '').trim() || 'This device';
    const res = await elan.startServer({
      deviceId: id,
      deviceName: name,
      appVersion: ver,
    });
    if (res?.ok) {
      logger.info('[lanServerManager] LAN server started for sync', res.addresses);
      return { listening: true };
    }
    return { listening: false, error: res?.error || 'start_failed' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('[lanServerManager] ensureLanServerForSync failed', msg);
    return { listening: false, error: msg };
  }
}

/**
 * Reconcile LAN device ids, refresh trusted contract ids, start listener if needed.
 * Returns the device list to use (ids may have been corrected from peer /info).
 */
export async function refreshLanServerForConnections(
  devices: ConnectedDevice[],
  ownDeviceName: string,
): Promise<ConnectedDevice[]> {
  const { devices: reconciled, repaired } = await reconcileLanDeviceIds(devices);
  if (repaired.length > 0) {
    logger.info('[lanServerManager] reconciled LAN device ids for', repaired.join(', '));
    await saveConnectedDevices(reconciled);
  }
  await syncLanTrustedContractDevices(reconciled);
  const hasLanPeer = reconciled.some((d) => !d.isLocal && d.lanHost);
  if (hasLanPeer) {
    await ensureLanServerForSync(ownDeviceName);
  }
  return reconciled;
}
