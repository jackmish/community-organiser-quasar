import { jsonStringField } from './lanPairingClient';
import { pickReachableLanHost, parseLanReachableAddresses } from './lanPairingHosts';

/** Pending LAN pairing request shown in the Wi‑Fi / LAN pairing dialog. */
export type LanPendingDetail = {
  token: string;
  remoteDeviceId: string;
  remoteName: string;
  remoteAppVersion?: string;
  remoteAddress?: string;
  /** Proposer's LAN IPs from pair request (preferred over socket-only loopback). */
  remoteLanAddresses?: string[];
};

export const LAN_PAIRED_EVENT = 'co21-lan-paired';

export type LanPairedDevicePayload = {
  id: string;
  name: string;
  type: string;
  lanHost: string;
  appVersion?: string;
};

export const LAN_PAIRING_PENDING_EVENT = 'co21-lan-pairing-pending';

/** Last incoming offer (survives if pairing modal was closed when IPC arrived). */
let stashedPendingOffer: LanPendingDetail | null = null;

export function stashLanPendingOffer(detail: LanPendingDetail): void {
  stashedPendingOffer = detail;
}

export function peekLanPendingOffer(): LanPendingDetail | null {
  return stashedPendingOffer;
}

export function clearLanPendingOffer(): void {
  stashedPendingOffer = null;
}

export function parseLanPendingDetail(raw: Record<string, unknown>): LanPendingDetail | null {
  const token = jsonStringField(raw.token, '');
  if (!token) return null;
  const remoteDeviceId = jsonStringField(raw.remoteDeviceId, '');
  if (!remoteDeviceId) return null;
  const detail: LanPendingDetail = {
    token,
    remoteDeviceId,
    remoteName: jsonStringField(raw.remoteName, 'Device'),
  };
  const ver = jsonStringField(raw.remoteAppVersion, '');
  if (ver) detail.remoteAppVersion = ver;
  const addr = jsonStringField(raw.remoteAddress, '');
  if (addr) detail.remoteAddress = addr;
  const addrs = parseLanReachableAddresses(raw.remoteLanAddresses);
  if (addrs.length) detail.remoteLanAddresses = addrs;
  return detail;
}

/** Parse IPC / notify-accepted payload into a Connections device row. */
export function parseLanPairedPayload(raw: Record<string, unknown>): LanPairedDevicePayload | null {
  const id =
    jsonStringField(raw.id, '').trim() || jsonStringField(raw.deviceId, '').trim();
  if (!id) return null;
  const lanHost = pickReachableLanHost([
    ...parseLanReachableAddresses(raw.lanReachableAddresses),
    ...parseLanReachableAddresses(raw.lanAddresses),
    jsonStringField(raw.lanHost, ''),
  ]);
  const row: LanPairedDevicePayload = {
    id,
    name: jsonStringField(raw.name, '') || jsonStringField(raw.deviceName, id),
    type: jsonStringField(raw.type, 'LAN') || 'LAN',
    lanHost,
  };
  const ver = jsonStringField(raw.appVersion, '');
  if (ver) row.appVersion = ver;
  return row;
}

export function dispatchLanPaired(payload: LanPairedDevicePayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LAN_PAIRED_EVENT, { detail: payload }));
}

export function dispatchLanPairingPending(detail: LanPendingDetail): void {
  if (typeof window === 'undefined') return;
  stashLanPendingOffer(detail);
  window.dispatchEvent(
    new CustomEvent(LAN_PAIRING_PENDING_EVENT, { detail: { ...detail } }),
  );
}

export function buildLanPairedPayloadFromPending(p: LanPendingDetail): LanPairedDevicePayload {
  const lanHost = pickReachableLanHost([
    ...(p.remoteLanAddresses ?? []),
    p.remoteAddress,
  ]);
  const row: LanPairedDevicePayload = {
    id: p.remoteDeviceId,
    name: p.remoteName,
    type: 'LAN',
    lanHost,
  };
  if (p.remoteAppVersion) row.appVersion = p.remoteAppVersion;
  return row;
}

/** Build Connections row from poll `accepted` peer (remote machine that was polled). */
export function buildLanPairedFromPollPeer(
  peer: { deviceId: string; deviceName: string; appVersion?: string; lanAddresses?: string[] },
  remoteHostHint: string,
): LanPairedDevicePayload {
  const row: LanPairedDevicePayload = {
    id: peer.deviceId.trim(),
    name: (peer.deviceName || '').trim() || peer.deviceId,
    type: 'LAN',
    lanHost: pickLanHostFromPeer(peer, remoteHostHint),
  };
  if (peer.appVersion) row.appVersion = peer.appVersion;
  return row;
}

export function pickLanHostFromPeer(
  peer: { lanAddresses?: string[] },
  fallbackHost: string,
): string {
  const fromPeer = pickReachableLanHost(
    Array.isArray(peer.lanAddresses) ? peer.lanAddresses : [],
  );
  if (fromPeer) return fromPeer;
  return pickReachableLanHost([fallbackHost]);
}
