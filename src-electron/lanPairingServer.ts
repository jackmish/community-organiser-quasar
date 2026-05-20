/**
 * Minimal HTTP server for LAN device pairing (Electron main process only).
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import type { BrowserWindow } from 'electron';
import logger from 'src/utils/logger';

import {
  CO21_LAN_API_PREFIX,
  CO21_LAN_PAIRING_PORT,
  lanHostMatchKeys,
} from 'src/modules/lan/lanPairingConstants';
import {
  isUsableLanHost,
  parseLanReachableAddresses,
  pickReachableLanHost,
} from '../src/modules/lan/lanPairingHosts';
import { sortLanIPv4Addresses } from '../src/modules/lan/lanNetwork';
import { startCo21MdnsAdvertise, stopCo21MdnsAdvertise } from './lanMdns';

export type LanIdentityPublic = {
  deviceId: string;
  deviceName: string;
  appVersion: string;
};

type Pending = {
  token: string;
  remoteDeviceId: string;
  remoteName: string;
  remoteAppVersion: string;
  remoteAddress: string;
  remoteLanAddresses: string[];
  createdAt: number;
  status: 'pending' | 'accepted' | 'rejected';
};

const PENDING_TTL_MS = 5 * 60 * 1000;
const ACCEPTED_PAIR_CACHE_MS = 10 * 60 * 1000;

let server: http.Server | null = null;
let identity: LanIdentityPublic | null = null;
const pendings = new Map<string, Pending>();
/** Lets initiator poll `accepted` after the first status response (token not deleted immediately). */
const acceptedPairByToken = new Map<
  string,
  { peer: Record<string, unknown>; acceptedAt: number }
>();
let getMainWindow: () => BrowserWindow | undefined = () => undefined;
let pruneTimer: ReturnType<typeof setInterval> | null = null;
/** When non-empty, only these device ids may POST sync/contract/propose. Empty = allow any proposer. */
let trustedContractDeviceIds = new Set<string>();
let trustedContractLanKeys = new Set<string>();

export type LanTrustedContractPeer = {
  deviceId: string;
  lanHost?: string;
};

function normalizeTrustedDeviceId(id: string): string {
  return String(id || '').trim().toLowerCase();
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendJson(res: http.ServerResponse, code: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(),
    'Content-Length': Buffer.byteLength(json, 'utf8'),
  });
  res.end(json);
}

function normalizeClientIp(raw: string | undefined): string {
  if (!raw) return '';
  let s = String(raw);
  if (s.startsWith('::ffff:')) s = s.slice(7);
  return s;
}

export function setLanTrustedContractDeviceIds(ids: string[]): void {
  setLanTrustedContractPeers(
    ids.map((deviceId) => ({ deviceId: String(deviceId || '') })),
  );
}

export function setLanTrustedContractPeers(peers: LanTrustedContractPeer[]): void {
  const idSet = new Set<string>();
  const hostSet = new Set<string>();
  for (const p of peers) {
    const id = normalizeTrustedDeviceId(p.deviceId);
    if (id) idSet.add(id);
    for (const k of lanHostMatchKeys(p.lanHost || '')) {
      hostSet.add(k);
    }
  }
  trustedContractDeviceIds = idSet;
  trustedContractLanKeys = hostSet;
  logger.info(
    `[lanPairingServer] trusted contract peers: ${idSet.size} id(s), ${hostSet.size} host key(s)`,
  );
}

function isContractProposerTrusted(proposerDeviceId: string, remoteAddr: string): boolean {
  if (trustedContractDeviceIds.size === 0 && trustedContractLanKeys.size === 0) {
    return true;
  }
  const prop = normalizeTrustedDeviceId(proposerDeviceId);
  if (prop && trustedContractDeviceIds.has(prop)) return true;
  const rip = normalizeClientIp(remoteAddr).toLowerCase();
  if (rip && trustedContractLanKeys.has(rip)) return true;
  return false;
}

export function getLanIPv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const out: string[] = [];
  for (const key of Object.keys(nets)) {
    for (const ni of nets[key] ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return sortLanIPv4Addresses(out);
}

function prunePendings(): void {
  const now = Date.now();
  for (const [token, p] of pendings) {
    if (now - p.createdAt > PENDING_TTL_MS) {
      pendings.delete(token);
    }
  }
  for (const [token, entry] of acceptedPairByToken) {
    if (now - entry.acceptedAt > ACCEPTED_PAIR_CACHE_MS) {
      acceptedPairByToken.delete(token);
    }
  }
}

function buildAcceptorPeerPayload(): Record<string, unknown> | null {
  if (!identity) return null;
  return {
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    appVersion: identity.appVersion,
    lanAddresses: getLanIPv4Addresses(),
  };
}

function cacheAcceptedPair(token: string): Record<string, unknown> | null {
  const peer = buildAcceptorPeerPayload();
  if (!peer) return null;
  acceptedPairByToken.set(token, { peer, acceptedAt: Date.now() });
  return peer;
}

function notifyRenderer(channel: string, detail: Record<string, unknown>): void {
  const win = getMainWindow();
  try {
    win?.webContents.send(channel, detail);
  } catch (e) {
    logger.warn('[lanPairingServer] webContents.send failed', e);
  }
}

function handleSyncContractPropose(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  void (async () => {
    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_body' });
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      sendJson(res, 400, { error: 'invalid_json' });
      return;
    }
    const snapshot = parsed.snapshot;
    const proposerDeviceId =
      typeof parsed.proposerDeviceId === 'string' ? parsed.proposerDeviceId : '';
    const proposerDeviceName =
      typeof parsed.proposerDeviceName === 'string' ? parsed.proposerDeviceName : '';
    if (!snapshot || typeof snapshot !== 'object' || !proposerDeviceId) {
      sendJson(res, 400, { error: 'invalid_contract' });
      return;
    }
    const remoteAddr = normalizeClientIp(req.socket.remoteAddress);
    if (!isContractProposerTrusted(proposerDeviceId, remoteAddr)) {
      logger.warn(
        `[lanPairingServer] contract rejected proposer=${proposerDeviceId} from=${remoteAddr} trustedIds=${trustedContractDeviceIds.size} trustedHosts=${trustedContractLanKeys.size}`,
      );
      sendJson(res, 403, { error: 'proposer_not_registered' });
      return;
    }
    const createdAt =
      typeof parsed.createdAt === 'number' && parsed.createdAt > 0
        ? parsed.createdAt
        : Date.now();
    notifyRenderer('lan:sync-contract-incoming', {
      createdAt,
      snapshot,
      proposerDeviceId,
      proposerDeviceName: proposerDeviceName || 'Unknown device',
    });
    sendJson(res, 200, { ok: true });
  })();
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function handlePairRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  remoteAddr: string,
): void {
  void (async () => {
    if (!identity) {
      sendJson(res, 503, { error: 'server_not_ready' });
      return;
    }
    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_body' });
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      sendJson(res, 400, { error: 'invalid_json' });
      return;
    }
    const remoteDeviceId = typeof parsed.deviceId === 'string' ? parsed.deviceId : '';
    const remoteName =
      typeof parsed.deviceName === 'string' ? parsed.deviceName : 'Unknown device';
    const remoteAppVersion =
      typeof parsed.appVersion === 'string' ? parsed.appVersion : '';
    if (!remoteDeviceId) {
      sendJson(res, 400, { error: 'missing_deviceId' });
      return;
    }

    const socketAddr = normalizeClientIp(remoteAddr);
    const bodyAddrs = parseLanReachableAddresses(parsed.lanReachableAddresses);
    const remoteLanAddresses = [
      ...bodyAddrs,
      ...(isUsableLanHost(socketAddr) ? [socketAddr] : []),
    ];

    const token = randomUUID();
    const pending: Pending = {
      token,
      remoteDeviceId,
      remoteName,
      remoteAppVersion,
      remoteAddress: socketAddr,
      remoteLanAddresses,
      createdAt: Date.now(),
      status: 'pending',
    };
    pendings.set(token, pending);

    const detail: Record<string, unknown> = {
      token,
      remoteDeviceId,
      remoteName,
      remoteAppVersion,
      remoteAddress: pending.remoteAddress,
    };
    if (remoteLanAddresses.length) {
      detail.remoteLanAddresses = remoteLanAddresses;
    }
    notifyRenderer('lan:pairing-pending', detail);

    sendJson(res, 200, {
      token,
      statusUrl: `${CO21_LAN_API_PREFIX}/pair/status/${token}`,
    });
  })();
}

/** Acceptor tells proposer (initiator) to register this machine after user confirmed pairing. */
function handlePairNotifyAccepted(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  void (async () => {
    if (!identity) {
      sendJson(res, 503, { error: 'server_not_ready' });
      return;
    }
    const socketAddr = normalizeClientIp(req.socket.remoteAddress);
    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_body' });
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      sendJson(res, 400, { error: 'invalid_json' });
      return;
    }
    const deviceId =
      typeof parsed.deviceId === 'string' ? parsed.deviceId.trim() : '';
    if (!deviceId) {
      sendJson(res, 400, { error: 'missing_deviceId' });
      return;
    }
    const deviceName =
      typeof parsed.deviceName === 'string' ? parsed.deviceName : 'Unknown device';
    const bodyAddrs = parseLanReachableAddresses(parsed.lanReachableAddresses);
    const lanHost = pickReachableLanHost([
      ...bodyAddrs,
      ...(isUsableLanHost(socketAddr) ? [socketAddr] : []),
    ]);
    const detail: Record<string, unknown> = {
      id: deviceId,
      name: deviceName,
      type: 'LAN',
      lanHost,
    };
    const ver = typeof parsed.appVersion === 'string' ? parsed.appVersion : '';
    if (ver) detail.appVersion = ver;
    if (bodyAddrs.length) detail.lanReachableAddresses = bodyAddrs;
    notifyRenderer('lan:pairing-complete', detail);
    sendJson(res, 200, { ok: true });
  })();
}

function handlePairStatus(res: http.ServerResponse, token: string): void {
  const cached = acceptedPairByToken.get(token);
  if (cached) {
    sendJson(res, 200, { status: 'accepted', peer: cached.peer });
    return;
  }
  const p = pendings.get(token);
  if (!p) {
    sendJson(res, 200, { status: 'unknown' });
    return;
  }
  if (p.status === 'pending') {
    sendJson(res, 200, { status: 'pending' });
    return;
  }
  if (p.status === 'rejected') {
    pendings.delete(token);
    sendJson(res, 200, { status: 'rejected' });
    return;
  }
  const peer = cacheAcceptedPair(token);
  if (!peer) {
    sendJson(res, 200, { status: 'unknown' });
    return;
  }
  sendJson(res, 200, { status: 'accepted', peer });
}

export function setLanPairingMainWindowProvider(fn: () => BrowserWindow | undefined): void {
  getMainWindow = fn;
}

export function startLanPairingServer(
  id: LanIdentityPublic,
): Promise<{ port: number; addresses: string[] }> {
  return new Promise((resolve, reject) => {
    stopLanPairingServer();
    identity = { ...id };

    server = http.createServer((req, res) => {
      try {
        if (!req.url) {
          sendJson(res, 400, { error: 'bad_request' });
          return;
        }
        const pathOnly = req.url.split('?')[0] || '';

        if (req.method === 'OPTIONS') {
          res.writeHead(204, corsHeaders());
          res.end();
          return;
        }

        if (req.method === 'GET' && pathOnly === `${CO21_LAN_API_PREFIX}/info`) {
          if (!identity) {
            sendJson(res, 503, { error: 'not_ready' });
            return;
          }
          sendJson(res, 200, {
            deviceId: identity.deviceId,
            deviceName: identity.deviceName,
            appVersion: identity.appVersion,
          });
          return;
        }

        if (req.method === 'POST' && pathOnly === `${CO21_LAN_API_PREFIX}/pair/request`) {
          const ra = normalizeClientIp(req.socket.remoteAddress);
          handlePairRequest(req, res, ra);
          return;
        }

        if (req.method === 'POST' && pathOnly === `${CO21_LAN_API_PREFIX}/pair/notify-accepted`) {
          handlePairNotifyAccepted(req, res);
          return;
        }

        if (req.method === 'GET' && pathOnly.startsWith(`${CO21_LAN_API_PREFIX}/pair/status/`)) {
          const token = pathOnly.slice(`${CO21_LAN_API_PREFIX}/pair/status/`.length);
          handlePairStatus(res, token);
          return;
        }

        if (req.method === 'POST' && pathOnly === `${CO21_LAN_API_PREFIX}/sync/contract/propose`) {
          void handleSyncContractPropose(req, res);
          return;
        }

        sendJson(res, 404, { error: 'not_found' });
      } catch (e) {
        logger.error('[lanPairingServer] request error', e);
        sendJson(res, 500, { error: 'internal' });
      }
    });

    server.once('error', (err: NodeJS.ErrnoException) => {
      logger.error('[lanPairingServer] listen error', err);
      server = null;
      identity = null;
      stopCo21MdnsAdvertise();
      reject(err);
    });

    server.listen(CO21_LAN_PAIRING_PORT, '0.0.0.0', () => {
      pruneTimer = setInterval(prunePendings, 60_000);
      try {
        if (identity) {
          startCo21MdnsAdvertise(identity, CO21_LAN_PAIRING_PORT);
        }
      } catch (e) {
        logger.warn('[lanPairingServer] mDNS advertise failed (LAN HTTP still works)', e);
      }
      resolve({ port: CO21_LAN_PAIRING_PORT, addresses: getLanIPv4Addresses() });
    });
  });
}

export function stopLanPairingServer(): void {
  stopCo21MdnsAdvertise();
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
  pendings.clear();
  acceptedPairByToken.clear();
  identity = null;
  if (server) {
    try {
      server.close();
    } catch {
      /* ignore */
    }
    server = null;
  }
}

export function resolveLanPairing(token: string, accept: boolean): boolean {
  const p = pendings.get(token);
  if (!p || p.status !== 'pending') return false;
  p.status = accept ? 'accepted' : 'rejected';
  if (accept) {
    cacheAcceptedPair(token);
  } else {
    acceptedPairByToken.delete(token);
  }
  return true;
}

export function isLanPairingListening(): boolean {
  return !!server;
}
