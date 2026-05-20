import { CO21_LAN_API_PREFIX } from './lanPairingConstants';

export type LanPeerInfo = {
  deviceId: string;
  deviceName: string;
  appVersion: string;
};

export type LanPairRequestBody = LanPeerInfo & {
  /** This machine's reachable IPv4/LAN addresses for reverse pairing. */
  lanReachableAddresses?: string[];
};

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
export function jsonStringField(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v.length ? v : fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return fallback;
}

export type LanFetchOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type LanRetryConnectOptions = LanFetchOptions & {
  attempts?: number;
  delayMs?: number;
  onAttemptFailed?: (attempt: number, error: Error) => void;
};

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Pairing cancelled'));
      return;
    }
    const timer = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new Error('Pairing cancelled'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function mergeAbortSignal(parent?: AbortSignal): AbortController {
  const controller = new AbortController();
  if (parent?.aborted) {
    controller.abort();
    return controller;
  }
  parent?.addEventListener('abort', () => controller.abort(), { once: true });
  return controller;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<Response> {
  const controller = mergeAbortSignal(parentSignal);
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: unknown) {
    if (controller.signal.aborted && !(parentSignal?.aborted)) {
      throw new Error(`Connection timed out (${Math.round(timeoutMs / 1000)}s)`);
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function lanFetchInfo(
  baseUrl: string,
  opts: LanFetchOptions = {},
): Promise<LanPeerInfo | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/info`;
  const timeoutMs = opts.timeoutMs ?? 5000;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs, opts.signal);
  } catch (e: unknown) {
    if (opts.signal?.aborted) throw new Error('Pairing cancelled');
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not connect to ${url} (${msg})`);
  }
  if (!res.ok) return null;
  const data = await parseJson(res);
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const deviceId = jsonStringField(o.deviceId, '').trim();
  if (!deviceId) return null;
  return {
    deviceId,
    deviceName: jsonStringField(o.deviceName, 'Unknown'),
    appVersion: jsonStringField(o.appVersion, ''),
  };
}

function pickFetchOpts(timeoutMs: number, signal?: AbortSignal): LanFetchOptions {
  const o: LanFetchOptions = { timeoutMs };
  if (signal) o.signal = signal;
  return o;
}

/** Try {@link lanFetchInfo} up to `attempts` times with `delayMs` between failures. */
export async function lanFetchInfoWithRetry(
  baseUrl: string,
  opts: LanRetryConnectOptions = {},
): Promise<LanPeerInfo | null> {
  const attempts = opts.attempts ?? 5;
  const delayMs = opts.delayMs ?? 5000;
  const timeoutMs = opts.timeoutMs ?? 5000;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (opts.signal?.aborted) throw new Error('Pairing cancelled');
    try {
      const info = await lanFetchInfo(baseUrl, pickFetchOpts(timeoutMs, opts.signal));
      if (info) return info;
      const err = new Error('No response from CO21 on that address');
      opts.onAttemptFailed?.(attempt, err);
    } catch (e: unknown) {
      if (opts.signal?.aborted) throw new Error('Pairing cancelled');
      const err = e instanceof Error ? e : new Error(String(e));
      opts.onAttemptFailed?.(attempt, err);
    }
    if (attempt < attempts) {
      await sleepMs(delayMs, opts.signal);
    }
  }
  return null;
}

export async function lanPostPairRequest(
  baseUrl: string,
  body: LanPairRequestBody,
  opts: LanFetchOptions = {},
): Promise<LanPairRequestResponse | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/pair/request`;
  const timeoutMs = opts.timeoutMs ?? 5000;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      timeoutMs,
      opts.signal,
    );
  } catch (e: unknown) {
    if (opts.signal?.aborted) throw new Error('Pairing cancelled');
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not connect to ${url} (${msg})`);
  }
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

export async function lanGetPairStatus(
  baseUrl: string,
  token: string,
  opts: LanFetchOptions = {},
): Promise<LanPairPollResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}${CO21_LAN_API_PREFIX}/pair/status/${encodeURIComponent(token)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { method: 'GET' }, opts.timeoutMs ?? 5000, opts.signal);
  } catch {
    if (opts.signal?.aborted) return { status: 'unknown' };
    return { status: 'unknown' };
  }
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

/** Poll until accepted, rejected, unknown token, timeout, or abort. */
export async function lanPollUntilResolved(
  baseUrl: string,
  token: string,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<LanPairPollResult> {
  const intervalMs = opts.intervalMs ?? 800;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (opts.signal?.aborted) return { status: 'unknown' };
    const r = await lanGetPairStatus(baseUrl, token, pickFetchOpts(5000, opts.signal));
    if (opts.signal?.aborted) return { status: 'unknown' };
    if (r.status === 'accepted' || r.status === 'rejected' || r.status === 'unknown') return r;
    await sleepMs(intervalMs, opts.signal);
  }
  return { status: 'unknown' };
}
