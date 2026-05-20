import { co21LanBaseUrl } from './lanPairingConstants';
import { CO21_LAN_API_PREFIX } from './lanPairingConstants';
import type { ConnectedDevice } from 'src/modules/storage/sync/deviceRoleAssignment';
import type { SyncContractPending } from 'src/modules/storage/sync/syncContractSettings';

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** POST proposed sync contract to a peer's LAN HTTP server. */
export async function lanPostSyncContractPropose(
  baseUrl: string,
  pending: SyncContractPending,
): Promise<boolean> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/sync/contract/propose`;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      },
      8000,
    );
    return res.ok;
  } catch {
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
      const host = (d.lanHost || '').trim();
      if (!host) return false;
      anyHost = true;
      const base = co21LanBaseUrl(host);
      if (!base) return false;
      return lanPostSyncContractPropose(base, pending);
    }),
  );
  if (!anyHost) return false;
  return results.some(Boolean);
}

export function remoteDevicesMissingLanHost(devices: ConnectedDevice[]): ConnectedDevice[] {
  return devices.filter((d) => !d.isLocal && !(d.lanHost || '').trim());
}
