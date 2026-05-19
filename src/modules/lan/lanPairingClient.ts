import { CO21_LAN_API_PREFIX } from './lanPairingConstants';

export type LanPeerInfo = {
  deviceId: string;
  deviceName: string;
  appVersion: string;
};

export type LanPairRequestBody = LanPeerInfo;

export type LanPairRequestResponse = {
  token: string;
  statusUrl: string;
};

export type LanPairPollResult = {
  status: 'pending' | 'accepted' | 'rejected' | 'unknown';
  peer?: LanPeerInfo & { lanAddresses?: string[] };
};

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** String for JSON fields — never uses Object stringification (@typescript-eslint/no-base-to-string). */
function jsonStringField(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v.length ? v : fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return fallback;
}

export async function lanFetchInfo(baseUrl: string): Promise<LanPeerInfo | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/info`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return null;
  const data = await parseJson(res);
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const deviceId = jsonStringField(o.deviceId, '');
  if (!deviceId) return null;
  return {
    deviceId,
    deviceName: jsonStringField(o.deviceName, 'Unknown'),
    appVersion: jsonStringField(o.appVersion, ''),
  };
}

export async function lanPostPairRequest(
  baseUrl: string,
  body: LanPairRequestBody,
): Promise<LanPairRequestResponse | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/pair/request`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await parseJson(res);
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const token = jsonStringField(o.token, '');
  if (!token) return null;
  const defaultStatus = `${CO21_LAN_API_PREFIX}/pair/status/${token}`;
  return {
    token,
    statusUrl: jsonStringField(o.statusUrl, '') || defaultStatus,
  };
}

export async function lanGetPairStatus(baseUrl: string, token: string): Promise<LanPairPollResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/pair/status/${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return { status: 'unknown' };
  const data = await parseJson(res);
  if (!data || typeof data !== 'object') return { status: 'unknown' };
  const root = data as Record<string, unknown>;
  if (typeof root.status !== 'string') return { status: 'unknown' };

  if (root.status === 'accepted' && root.peer && typeof root.peer === 'object') {
    const p = root.peer as Record<string, unknown>;
    const peer: LanPeerInfo & { lanAddresses?: string[] } = {
      deviceId: jsonStringField(p.deviceId, ''),
      deviceName: jsonStringField(p.deviceName, ''),
      appVersion: jsonStringField(p.appVersion, ''),
    };
    const addrs = p.lanAddresses;
    if (Array.isArray(addrs)) {
      peer.lanAddresses = addrs.map((x) => jsonStringField(x, '')).filter((s) => s.length > 0);
    }
    return { status: 'accepted', peer };
  }
  if (root.status === 'rejected') return { status: 'rejected' };
  if (root.status === 'pending') return { status: 'pending' };
  return { status: 'unknown' };
}

/** Poll until accepted, rejected, unknown token, or timeout (ms). */
export async function lanPollUntilResolved(
  baseUrl: string,
  token: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<LanPairPollResult> {
  const intervalMs = opts.intervalMs ?? 800;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await lanGetPairStatus(baseUrl, token);
    if (r.status === 'accepted' || r.status === 'rejected' || r.status === 'unknown') return r;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { status: 'unknown' };
}
