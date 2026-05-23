import { co21LanBaseUrl } from './lanPairingConstants';
import { CO21_LAN_API_PREFIX } from './lanPairingConstants';
import type { ConnectedDevice } from 'src/modules/storage/sync/deviceRoleAssignment';
import type { SyncContractPending } from 'src/modules/storage/sync/syncContractSettings';
import logger from 'src/utils/logger';
import { lanHttpRequest } from './lanHttp';
import {
  listCandidateHostsForDevice,
  rememberPeerLanHost,
  patchPeerLanHostInConnections,
} from './lanRemoteHost';

export type SyncContractRejectPayload = {
  rejectorDeviceId: string;
  rejectorDeviceName: string;
  proposerDeviceId: string;
  createdAt?: number;
};

/** POST contract rejection to the proposer's LAN HTTP server. */
export async function lanPostSyncContractReject(
  baseUrl: string,
  payload: SyncContractRejectPayload,
): Promise<boolean> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/sync/contract/reject`;
  try {
    const res = await lanHttpRequest({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 8000,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** POST proposed sync contract to a peer's LAN HTTP server. */
export async function lanPostSyncContractPropose(
  baseUrl: string,
  pending: SyncContractPending,
): Promise<boolean> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/sync/contract/propose`;
  try {
    const res = await lanHttpRequest({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pending),
      timeoutMs: 8000,
    });
    if (!res.ok) {
      logger.warn('[lanSyncContract] propose failed', res.status, baseUrl);
    }
    return res.ok;
  } catch (e) {
    logger.warn('[lanSyncContract] propose error', baseUrl, e);
    return false;
  }
}

/** Push contract to all LAN-connected remote devices (best-effort). */
export async function pushSyncContractToLanPeers(
  devices: ConnectedDevice[],
  pending: SyncContractPending,
): Promise<boolean> {
  const remotes = devices.filter((d) => !d.isLocal);
  if (!remotes.length) return false;

  let anyHost = false;
  const results = await Promise.all(
    remotes.map(async (d) => {
      const hosts = await listCandidateHostsForDevice(d);
      if (!hosts.length) return false;
      anyHost = true;
      for (const host of hosts) {
        const base = co21LanBaseUrl(host);
        if (!base) continue;
        const ok = await lanPostSyncContractPropose(base, pending);
        if (ok) {
          await rememberPeerLanHost(d.id, host);
          await patchPeerLanHostInConnections(d.id, host);
          return true;
        }
      }
      return false;
    }),
  );
  if (!anyHost) return false;
  return results.some(Boolean);
}

export function remoteDevicesMissingLanHost(devices: ConnectedDevice[]): ConnectedDevice[] {
  return devices.filter((d) => !d.isLocal && !(d.lanHost || '').trim());
}
