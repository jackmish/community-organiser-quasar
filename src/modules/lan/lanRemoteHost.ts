import { pickReachableLanHost, isUsableLanHost, normalizeLanHostCandidate } from './lanPairingHosts';
import {
  loadConnectedDevices,
  normalizeDeviceId,
  mergeLocalDeviceIntoList,
  saveConnectedDevices,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { loadPendingIncomingContract } from 'src/modules/storage/sync/syncContractSettings';
import type { SyncContractPending } from 'src/modules/storage/sync/syncContractSettings';
import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import { loadOwnDeviceMeta } from 'src/modules/storage/sync/deviceRoleAssignment';
import { syncLanTrustedContractDevices } from './lanServerManager';
import logger from 'src/utils/logger';

function hostMapFromSettings(data: Record<string, unknown>): Record<string, string> {
  const raw = data.lanPeerHostsByDeviceId;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const h = normalizeLanHostCandidate(String(v || ''));
    if (isUsableLanHost(h)) out[normalizeDeviceId(k)] = h;
  }
  return out;
}

function candidateMapFromSettings(data: Record<string, unknown>): Record<string, string[]> {
  const raw = data.lanPeerHostCandidatesByDeviceId;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = normalizeDeviceId(k);
    const list = Array.isArray(v) ? v : [v];
    const hosts: string[] = [];
    for (const item of list) {
      const h = normalizeLanHostCandidate(String(item || ''));
      if (isUsableLanHost(h) && !hosts.includes(h)) hosts.push(h);
    }
    if (hosts.length) out[id] = hosts;
  }
  return out;
}

/** Persist last-known LAN IP for a peer (survives bad pairing payloads). */
export async function rememberPeerLanHost(deviceId: string, host: string): Promise<void> {
  const h = normalizeLanHostCandidate(host);
  if (!isUsableLanHost(h)) return;
  const data = await loadCo21Settings();
  const map = hostMapFromSettings(data);
  map[normalizeDeviceId(deviceId)] = h;
  await patchCo21Settings({ lanPeerHostsByDeviceId: map });
  await rememberPeerLanHostCandidates(deviceId, [h]);
}

/** Remember all known LAN IPs for a peer (wrong adapter / VPN on desktop). */
export async function rememberPeerLanHostCandidates(
  deviceId: string,
  hosts: Array<string | undefined | null>,
): Promise<void> {
  const merged: string[] = [];
  for (const c of hosts) {
    const h = normalizeLanHostCandidate(String(c || ''));
    if (isUsableLanHost(h) && !merged.includes(h)) merged.push(h);
  }
  if (!merged.length) return;
  const id = normalizeDeviceId(deviceId);
  const data = await loadCo21Settings();
  const map = candidateMapFromSettings(data);
  const prev = map[id] ?? [];
  for (const h of merged) {
    if (!prev.includes(h)) prev.push(h);
  }
  map[id] = prev;
  await patchCo21Settings({ lanPeerHostCandidatesByDeviceId: map });
  const primary = pickReachableLanHost(prev);
  if (primary) {
    const hostMap = hostMapFromSettings(data);
    hostMap[id] = primary;
    await patchCo21Settings({ lanPeerHostsByDeviceId: hostMap });
  }
}

export async function loadRememberedPeerLanHost(deviceId: string): Promise<string> {
  const data = await loadCo21Settings();
  const map = hostMapFromSettings(data);
  return map[normalizeDeviceId(deviceId)] || '';
}

export async function loadPeerLanHostCandidates(deviceId: string): Promise<string[]> {
  const data = await loadCo21Settings();
  const map = candidateMapFromSettings(data);
  return map[normalizeDeviceId(deviceId)] ?? [];
}

/** Ordered hosts to try when reaching a peer (row, remembered, pairing list). */
export async function listCandidateHostsForDevice(
  device: ConnectedDevice,
  opts?: { incoming?: SyncContractPending | null },
): Promise<string[]> {
  const out: string[] = [];
  const push = (raw: string) => {
    const h = normalizeLanHostCandidate(raw);
    if (isUsableLanHost(h) && !out.includes(h)) out.push(h);
  };
  push(device.lanHost || '');
  push(await loadRememberedPeerLanHost(device.id));
  for (const h of await loadPeerLanHostCandidates(device.id)) push(h);

  const norm = normalizeDeviceId(device.id);
  let incoming = opts?.incoming;
  if (incoming === undefined) {
    incoming = await loadPendingIncomingContract();
  }
  if (incoming && normalizeDeviceId(incoming.proposerDeviceId) === norm) {
    push(incoming.proposerLanHost || '');
  }

  return out;
}

/** Update Connections row when we discover a working LAN IP. */
export async function patchPeerLanHostInConnections(
  deviceId: string,
  host: string,
): Promise<void> {
  const h = normalizeLanHostCandidate(host);
  if (!isUsableLanHost(h)) return;
  const local = await loadOwnDeviceMeta();
  const loaded = await loadConnectedDevices();
  const devices = mergeLocalDeviceIntoList(loaded, local);
  const norm = normalizeDeviceId(deviceId);
  let changed = false;
  const next = devices.map((d) => {
    if (d.isLocal || normalizeDeviceId(d.id) !== norm) return d;
    if ((d.lanHost || '').trim() === h) return d;
    changed = true;
    return { ...d, lanHost: h };
  });
  if (changed) await saveConnectedDevices(next);
}

/** Best-effort LAN host for a remote device row (Connections / sync targets). */
export async function resolvePeerLanHostForDevice(
  device: ConnectedDevice,
  opts?: { incoming?: SyncContractPending | null },
): Promise<string> {
  const fromRow = (device.lanHost || '').trim();
  if (fromRow) return fromRow;

  const remembered = await loadRememberedPeerLanHost(device.id);
  if (remembered) return remembered;

  const storedCandidates = await loadPeerLanHostCandidates(device.id);
  const fromCandidates = pickReachableLanHost(storedCandidates);
  if (fromCandidates) return fromCandidates;

  const norm = normalizeDeviceId(device.id);
  let incoming = opts?.incoming;
  if (incoming === undefined) {
    incoming = await loadPendingIncomingContract();
  }
  if (incoming) {
    const propNorm = normalizeDeviceId(incoming.proposerDeviceId);
    if (propNorm === norm) {
      const h = (incoming.proposerLanHost || '').trim();
      if (h) return h;
    }
  }

  const loaded = await loadConnectedDevices();
  const row = loaded.find((d) => !d.isLocal && normalizeDeviceId(d.id) === norm);
  return (row?.lanHost || '').trim();
}

/** Fill missing `lanHost` on remotes using remembered IPs + incoming contract proposer IP. */
export async function enrichRemotesLanHosts(
  devices: ConnectedDevice[],
): Promise<ConnectedDevice[]> {
  const incoming = await loadPendingIncomingContract();
  const proposerHost =
    incoming && (incoming.proposerLanHost || '').trim()
      ? normalizeLanHostCandidate(incoming.proposerLanHost || '')
      : '';
  const proposerNorm = incoming ? normalizeDeviceId(incoming.proposerDeviceId) : '';

  return Promise.all(
    devices.map(async (d) => {
      if (d.isLocal) return d;
      const host = await resolvePeerLanHostForDevice(d, { incoming });
      if (host) {
        const trimmed = host.trim();
        return trimmed === (d.lanHost || '').trim() ? d : { ...d, lanHost: trimmed };
      }
      if (proposerHost && proposerNorm && normalizeDeviceId(d.id) === proposerNorm) {
        return { ...d, lanHost: proposerHost };
      }
      return d;
    }),
  );
}

/** Merge host candidates for pairing persistence. */
export function pickLanHostFromCandidates(
  ...groups: Array<Array<string | undefined | null>>
): string {
  const flat: string[] = [];
  for (const g of groups) {
    for (const c of g) {
      const s = normalizeLanHostCandidate(String(c || ''));
      if (s) flat.push(s);
    }
  }
  return pickReachableLanHost(flat);
}

/**
 * Load remotes with filled `lanHost`, optionally persist to Connections + trusted peers.
 * Use before probe/sync/contract delivery (not only rows that already have a host).
 */
export async function prepareRemotesForLanOps(opts?: {
  persistHosts?: boolean;
  /** Use in-memory device list (e.g. Connections dialog) before reading storage. */
  devices?: ConnectedDevice[];
}): Promise<ConnectedDevice[]> {
  const local = await loadOwnDeviceMeta();
  const before = opts?.devices?.length
    ? mergeLocalDeviceIntoList(opts.devices, local)
    : mergeLocalDeviceIntoList(await loadConnectedDevices(), local);
  const enriched = await enrichRemotesLanHosts(before);
  const hostPatched = enriched.some((d) => {
    if (d.isLocal) return false;
    const prev = before.find((x) => x.id === d.id);
    return !!(d.lanHost || '').trim() && !(prev?.lanHost || '').trim();
  });
  if (hostPatched && opts?.persistHosts !== false) {
    await saveConnectedDevices(enriched);
    const settings = await loadCo21Settings();
    const ownName =
      typeof settings.ownDeviceName === 'string' ? settings.ownDeviceName.trim() : local.name;
    await syncLanTrustedContractDevices(enriched);
    for (const d of enriched) {
      if (!d.isLocal && (d.lanHost || '').trim()) {
        await rememberPeerLanHost(d.id, d.lanHost || '');
      }
    }
    logger.info('[lanRemoteHost] saved LAN host(s) for remote peer(s)');
  }
  return enriched.filter((d) => !d.isLocal && (d.lanHost || '').trim());
}
