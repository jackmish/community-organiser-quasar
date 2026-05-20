import { jsonStringField } from './lanPairingClient';

/** Pending LAN pairing request shown in the Wi‑Fi / LAN pairing dialog. */
export type LanPendingDetail = {
  token: string;
  remoteDeviceId: string;
  remoteName: string;
  remoteAppVersion?: string;
  remoteAddress?: string;
};

export type LanPairedDevicePayload = {
  id: string;
  name: string;
  type: string;
  lanHost: string;
  appVersion?: string;
};

export const LAN_PAIRING_PENDING_EVENT = 'co21-lan-pairing-pending';

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
  return detail;
}

export function dispatchLanPairingPending(detail: LanPendingDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LAN_PAIRING_PENDING_EVENT, { detail }));
}

export function buildLanPairedPayloadFromPending(p: LanPendingDetail): LanPairedDevicePayload {
  const row: LanPairedDevicePayload = {
    id: p.remoteDeviceId,
    name: p.remoteName,
    type: 'LAN',
    lanHost: p.remoteAddress || '',
  };
  if (p.remoteAppVersion) row.appVersion = p.remoteAppVersion;
  return row;
}

export function pickLanHostFromPeer(
  peer: { lanAddresses?: string[] },
  fallbackHost: string,
): string {
  const addrs = peer.lanAddresses;
  if (Array.isArray(addrs) && addrs.length > 0) {
    const first = addrs.find((a) => typeof a === 'string' && a.trim().length > 0);
    if (first) return first.trim();
  }
  return fallbackHost;
}
