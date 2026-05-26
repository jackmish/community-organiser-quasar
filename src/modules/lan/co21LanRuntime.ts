import { Capacitor } from '@capacitor/core';
import { Co21LanServer } from 'co21-lan-server';
import type { LanTrustedPeer } from 'co21-lan-server';
import { normalizeLanListenerDetail, parseCapacitorJsonField } from './lanCapacitorPayload';
import logger from 'src/utils/logger';

export type Co21LanIdentity = {
  deviceId: string;
  deviceName: string;
  appVersion: string;
};

/** Same surface as `window.electronLan` for LAN server + pairing events. */
export type Co21LanApi = {
  startServer: (identity: Co21LanIdentity) => Promise<{ ok?: boolean; error?: string; addresses?: string[] }>;
  stopServer: () => Promise<unknown>;
  status: () => Promise<{ listening?: boolean; addresses?: string[] }>;
  setTrustedContractDevices: (
    peers: Array<string | { deviceId: string; lanHost?: string }>,
  ) => Promise<unknown>;
  resolvePair?: (token: string, accept: boolean) => Promise<{ ok?: boolean }>;
  browseCo21?: (opts: Record<string, unknown>) => Promise<unknown>;
  onPairingPending: (callback: (detail: Record<string, unknown>) => void) => () => void;
  onPairingComplete: (callback: (detail: Record<string, unknown>) => void) => () => void;
  onSyncContractIncoming: (callback: (detail: unknown) => void | Promise<void>) => () => void;
  onSyncContractRejected: (callback: (detail: unknown) => void | Promise<void>) => () => void;
  onSyncContractAccepted?: (callback: (detail: unknown) => void | Promise<void>) => () => void;
};

let capacitorBridgeInstalled = false;
let capacitorApi: Co21LanApi | null = null;

function dispatchWindowEvent(name: string, detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function installCapacitorLanBridge(): void {
  if (capacitorBridgeInstalled || Capacitor.getPlatform() !== 'android') return;
  capacitorBridgeInstalled = true;

  const pendingCallbacks = new Set<(d: Record<string, unknown>) => void>();
  const completeCallbacks = new Set<(d: Record<string, unknown>) => void>();

  void Co21LanServer.addListener('pairingPending', (ev) => {
    const detail = normalizeLanListenerDetail(ev);
    dispatchWindowEvent('co21-lan-pairing-pending', detail);
    for (const cb of pendingCallbacks) {
      void Promise.resolve(cb(detail)).catch((e) =>
        logger.warn('[co21LanRuntime] pairingPending callback', e),
      );
    }
  });

  void Co21LanServer.addListener('pairingComplete', (ev) => {
    const detail = normalizeLanListenerDetail(ev);
    dispatchWindowEvent('co21-lan-paired', detail);
    for (const cb of completeCallbacks) {
      void Promise.resolve(cb(detail)).catch((e) =>
        logger.warn('[co21LanRuntime] pairingComplete callback', e),
      );
    }
  });

  void Co21LanServer.addListener('syncContractIncoming', (ev) => {
    const raw = normalizeLanListenerDetail(ev);
    const detail: Record<string, unknown> = { ...raw };
    const snapshot = parseCapacitorJsonField<Record<string, unknown>>(raw.snapshot);
    if (snapshot) detail.snapshot = snapshot;
    for (const cb of syncIncomingCallbacks) {
      void Promise.resolve(cb(detail)).catch((e) =>
        logger.warn('[co21LanRuntime] syncContractIncoming', e),
      );
    }
  });

  void Co21LanServer.addListener('syncContractRejected', (ev) => {
    const detail = normalizeLanListenerDetail(ev);
    for (const cb of syncRejectedCallbacks) {
      void Promise.resolve(cb(detail)).catch((e) =>
        logger.warn('[co21LanRuntime] syncContractRejected', e),
      );
    }
  });

  void Co21LanServer.addListener('syncContractAccepted', (ev) => {
    const detail = normalizeLanListenerDetail(ev);
    for (const cb of syncAcceptedCallbacks) {
      void Promise.resolve(cb(detail)).catch((e) =>
        logger.warn('[co21LanRuntime] syncContractAccepted', e),
      );
    }
  });

  void Co21LanServer.addListener('syncExchangeRequest', (ev) => {
    void handleSyncExchangeRequest(ev as { requestId?: string; body?: string });
  });

  capacitorApi = {
    startServer: async (identity) => {
      const res = await Co21LanServer.startServer(identity);
      return {
        ok: res.ok,
        ...(res.error ? { error: res.error } : {}),
        ...(res.addresses?.length ? { addresses: res.addresses } : {}),
      };
    },
    stopServer: () => Co21LanServer.stopServer(),
    status: async () => {
      const s = await Co21LanServer.status();
      return { listening: s.listening, addresses: s.addresses };
    },
    setTrustedContractDevices: async (peers) => {
      const mapped: LanTrustedPeer[] = peers.map((p) => {
        if (typeof p === 'string') return { deviceId: p };
        const peer: LanTrustedPeer = { deviceId: p.deviceId };
        const host = (p.lanHost || '').trim();
        if (host) peer.lanHost = host;
        return peer;
      });
      return Co21LanServer.setTrustedContractDevices({ peers: mapped });
    },
    resolvePair: async (token, accept) => Co21LanServer.resolvePair({ token, accept }),
    onPairingPending: (callback) => {
      pendingCallbacks.add(callback);
      return () => pendingCallbacks.delete(callback);
    },
    onPairingComplete: (callback) => {
      completeCallbacks.add(callback);
      return () => completeCallbacks.delete(callback);
    },
    onSyncContractIncoming: (callback) => {
      syncIncomingCallbacks.add(callback);
      return () => syncIncomingCallbacks.delete(callback);
    },
    onSyncContractRejected: (callback) => {
      syncRejectedCallbacks.add(callback);
      return () => syncRejectedCallbacks.delete(callback);
    },
    onSyncContractAccepted: (callback) => {
      syncAcceptedCallbacks.add(callback);
      return () => syncAcceptedCallbacks.delete(callback);
    },
  };
}

const syncIncomingCallbacks = new Set<(d: unknown) => void | Promise<void>>();
const syncRejectedCallbacks = new Set<(d: unknown) => void | Promise<void>>();
const syncAcceptedCallbacks = new Set<(d: unknown) => void | Promise<void>>();

async function handleSyncExchangeRequest(ev: { requestId?: string; body?: string }): Promise<void> {
  const requestId = String(ev.requestId || '').trim();
  if (!requestId) return;

  const fn = (
    globalThis as typeof globalThis & {
      __co21LanSyncExchange?: (req: unknown) => Promise<unknown>;
    }
  ).__co21LanSyncExchange;

  let responseJson = JSON.stringify({
    ok: false,
    error: 'bridge_off',
    nextToken: '',
    since: Date.now(),
    groups: [],
    tasks: [],
  });

  if (typeof fn === 'function') {
    try {
      const parsed = ev.body ? (JSON.parse(ev.body) as unknown) : {};
      const result = await fn(parsed);
      responseJson = JSON.stringify(result ?? { ok: false, error: 'empty_response' });
    } catch (e) {
      logger.error('[co21LanRuntime] sync exchange failed', e);
      responseJson = JSON.stringify({ ok: false, error: 'bridge_error' });
    }
  }

  try {
    await Co21LanServer.resolveSyncExchange({ requestId, responseJson });
  } catch (e) {
    logger.warn('[co21LanRuntime] resolveSyncExchange failed', e);
  }
}

/** Install native→JS listeners once (Android). Safe to call multiple times. */
export function ensureCo21LanCapacitorBridge(): void {
  installCapacitorLanBridge();
}

/** Electron preload API or Capacitor Android shim. */
export function getCo21LanApi(): Co21LanApi | undefined {
  if (typeof window === 'undefined') return undefined;
  const electron = (window as Window & { electronLan?: Co21LanApi }).electronLan;
  if (electron?.startServer) return electron;
  if (Capacitor.getPlatform() === 'android') {
    ensureCo21LanCapacitorBridge();
    return capacitorApi ?? undefined;
  }
  return undefined;
}

export function hasCo21LanServer(): boolean {
  return !!getCo21LanApi()?.startServer;
}
