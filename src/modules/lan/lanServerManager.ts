import { deviceId } from 'src/modules/storage/sync/deviceId';
import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import {
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  saveConnectedDevices,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { reconcileLanDeviceIds } from './lanDeviceReconcile';
import { getCo21LanApi } from './co21LanRuntime';
import logger from 'src/utils/logger';

function co21Lan() {
  return getCo21LanApi();
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

export function registeredRemoteLanPeers(
  devices: ConnectedDevice[],
): Array<{ deviceId: string; lanHost?: string }> {
  return devices
    .filter((d) => !d.isLocal && d.id)
    .map((d) => {
      const peer: { deviceId: string; lanHost?: string } = { deviceId: d.id };
      const host = (d.lanHost || '').trim();
      if (host) peer.lanHost = host;
      return peer;
    });
}

/** Tell main process which peers may POST sync contracts (empty = allow any). */
export async function syncLanTrustedContractDevices(devices: ConnectedDevice[]): Promise<void> {
  const elan = co21Lan();
  if (!elan?.setTrustedContractDevices) return;
  const peers = registeredRemoteLanPeers(devices);
  try {
    await elan.setTrustedContractDevices(peers);
  } catch (e) {
    logger.warn('[lanServerManager] setTrustedContractDevices failed', e);
  }
}

export async function isLanServerListening(): Promise<boolean> {
  const elan = co21Lan();
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
  opts?: { force?: boolean; restart?: boolean },
): Promise<{ listening: boolean; error?: string }> {
  const elan = co21Lan();
  if (!elan?.startServer) {
    return { listening: false, error: 'not_native' };
  }

  const autoListen = opts?.force ? true : await loadLanAutoListen();
  if (!autoListen) {
    return { listening: false, error: 'auto_listen_disabled' };
  }

  const listening = await isLanServerListening();
  if (listening && !opts?.restart) {
    return { listening: true };
  }
  if (listening && opts?.restart && elan.stopServer) {
    try {
      await elan.stopServer();
    } catch (e) {
      logger.warn('[lanServerManager] stopServer before restart failed', e);
    }
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
  opts?: { restart?: boolean; skipReconcileProbe?: boolean },
): Promise<ConnectedDevice[]> {
  // Do not restart by default — restarting clears in-flight pairing tokens on this machine.
  await ensureLanServerForSync(ownDeviceName, { restart: opts?.restart ?? false });

  const local = await loadOwnDeviceMeta();
  const localName = (ownDeviceName || '').trim() || local.name;
  const withLocal = mergeLocalDeviceIntoList(devices, { ...local, name: localName });

  let reconciled = withLocal;
  let repaired: string[] = [];
  if (!opts?.skipReconcileProbe) {
    const result = await reconcileLanDeviceIds(withLocal);
    reconciled = result.devices;
    repaired = result.repaired;
  }
  const out = mergeLocalDeviceIntoList(reconciled, { ...local, name: localName });
  if (repaired.length > 0) {
    logger.info('[lanServerManager] reconciled LAN device ids for', repaired.join(', '));
    await saveConnectedDevices(out);
  }
  await syncLanTrustedContractDevices(out);
  return out;
}
