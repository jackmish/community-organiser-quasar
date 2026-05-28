import { adoptLanSyncNextToken, createLanSyncToken } from 'src/modules/lan/lanSyncAuth';
import { patchCo21Settings, loadCo21Settings } from './roleProfileSettings';
import { normalizeDeviceId } from './deviceRoleAssignment';

export type SyncPeerRunStatus = 'idle' | 'running' | 'ok' | 'failed';

export type SyncPeerRecord = {
  peerDeviceId: string;
  peerDeviceName?: string;
  /** Rotating token for the next LAN sync request to/from this peer. */
  sessionToken: string;
  lastSyncAt: number;
  lastSyncStatus: SyncPeerRunStatus;
  lastSyncMessage?: string;
  /** Last time we checked LAN reachability. */
  peerCheckedAt?: number;
  peerInRange?: boolean;
  /** Per-group / per-task sync watermark (ms) for incremental sync. */
  groupSyncedAt: Record<string, number>;
  taskSyncedAt: Record<string, number>;
  /** Last time a full (since=0) exchange completed with this peer. */
  lastFullSyncAt?: number;
};

function asNumberRecord(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(v)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[key] = val;
  }
  return out;
}

function normalizePeer(raw: unknown): SyncPeerRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as SyncPeerRecord;
  const id = typeof o.peerDeviceId === 'string' ? o.peerDeviceId.trim() : '';
  if (!id) return null;
  const row: SyncPeerRecord = {
    peerDeviceId: id,
    sessionToken:
      typeof o.sessionToken === 'string' && o.sessionToken.trim()
        ? o.sessionToken.trim()
        : createLanSyncToken(),
    lastSyncAt: typeof o.lastSyncAt === 'number' ? o.lastSyncAt : 0,
    lastSyncStatus:
      o.lastSyncStatus === 'running' ||
      o.lastSyncStatus === 'ok' ||
      o.lastSyncStatus === 'failed'
        ? o.lastSyncStatus
        : 'idle',
    ...(typeof o.lastSyncMessage === 'string' ? { lastSyncMessage: o.lastSyncMessage } : {}),
    ...(typeof o.peerCheckedAt === 'number' ? { peerCheckedAt: o.peerCheckedAt } : {}),
    ...(typeof o.peerInRange === 'boolean' ? { peerInRange: o.peerInRange } : {}),
    groupSyncedAt: asNumberRecord(o.groupSyncedAt),
    taskSyncedAt: asNumberRecord(o.taskSyncedAt),
    ...(typeof o.lastFullSyncAt === 'number' ? { lastFullSyncAt: o.lastFullSyncAt } : {}),
  };
  if (typeof o.peerDeviceName === 'string' && o.peerDeviceName.trim()) {
    row.peerDeviceName = o.peerDeviceName.trim();
  }
  return row;
}

export async function loadSyncPeerStates(): Promise<SyncPeerRecord[]> {
  const data = await loadCo21Settings();
  const raw = data.syncPeerStates;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePeer).filter((p): p is SyncPeerRecord => !!p);
}

async function saveSyncPeerStates(peers: SyncPeerRecord[]): Promise<boolean> {
  return patchCo21Settings({ syncPeerStates: peers });
}

export async function findSyncPeerState(peerDeviceId: string): Promise<SyncPeerRecord | null> {
  const norm = normalizeDeviceId(peerDeviceId);
  return (
    (await loadSyncPeerStates()).find((p) => normalizeDeviceId(p.peerDeviceId) === norm) ?? null
  );
}

export async function upsertSyncPeerState(
  patch: Partial<SyncPeerRecord> & { peerDeviceId: string },
): Promise<SyncPeerRecord> {
  const list = await loadSyncPeerStates();
  const norm = normalizeDeviceId(patch.peerDeviceId);
  const idx = list.findIndex((p) => normalizeDeviceId(p.peerDeviceId) === norm);
  const base: SyncPeerRecord =
    idx >= 0
      ? list[idx]!
      : {
          peerDeviceId: patch.peerDeviceId,
          sessionToken: createLanSyncToken(),
          lastSyncAt: 0,
          lastSyncStatus: 'idle',
          groupSyncedAt: {},
          taskSyncedAt: {},
        };
  const next: SyncPeerRecord = {
    ...base,
    ...patch,
    peerDeviceId: patch.peerDeviceId,
    groupSyncedAt: { ...base.groupSyncedAt, ...(patch.groupSyncedAt ?? {}) },
    taskSyncedAt: { ...base.taskSyncedAt, ...(patch.taskSyncedAt ?? {}) },
  };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveSyncPeerStates(list);
  return next;
}

/** Initialise or adopt session token when a contract is accepted. */
export async function ensurePeerSyncSession(
  peerDeviceId: string,
  peerDeviceName: string,
  sessionToken?: string,
): Promise<SyncPeerRecord> {
  const existing = await findSyncPeerState(peerDeviceId);
  if (existing) {
    return upsertSyncPeerState({
      peerDeviceId,
      peerDeviceName,
      ...(sessionToken ? { sessionToken } : {}),
    });
  }
  return upsertSyncPeerState({
    peerDeviceId,
    peerDeviceName,
    sessionToken: sessionToken || createLanSyncToken(),
    lastSyncAt: 0,
    lastSyncStatus: 'idle',
    groupSyncedAt: {},
    taskSyncedAt: {},
  });
}

export function adoptNextSyncToken(peer: SyncPeerRecord, nextToken: string): SyncPeerRecord {
  return {
    ...peer,
    sessionToken: adoptLanSyncNextToken(peer.sessionToken, nextToken),
  };
}
