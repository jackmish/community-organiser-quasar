import { normalizeDeviceId } from './deviceRoleAssignment';
import { patchCo21Settings, loadCo21Settings } from './roleProfileSettings';
import type { SyncPeerRecord } from './syncPeerState';

export type TaskDeletionTombstone = {
  id: string;
  deletedAt: string;
  groupId?: string;
};

type TombstoneMap = Record<string, TaskDeletionTombstone>;

const SETTINGS_KEY = 'deletedTaskTombstones';

function tombstoneDeletedMs(t: TaskDeletionTombstone): number {
  const n = Date.parse(t.deletedAt);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTombstone(raw: unknown): TaskDeletionTombstone | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as TaskDeletionTombstone;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const deletedAt = typeof o.deletedAt === 'string' ? o.deletedAt.trim() : '';
  if (!id || !deletedAt) return null;
  const row: TaskDeletionTombstone = { id, deletedAt };
  if (typeof o.groupId === 'string' && o.groupId.trim()) row.groupId = o.groupId.trim();
  return row;
}

async function loadTombstoneMap(): Promise<TombstoneMap> {
  const data = await loadCo21Settings();
  const raw = data[SETTINGS_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: TombstoneMap = {};
  for (const [key, val] of Object.entries(raw)) {
    const t = normalizeTombstone(val);
    if (t) out[key] = t;
  }
  return out;
}

async function saveTombstoneMap(map: TombstoneMap): Promise<void> {
  await patchCo21Settings({ [SETTINGS_KEY]: map });
}

/** Active deletion tombstones (tasks removed locally, pending peer ack). */
export async function getTaskDeletionTombstoneMap(): Promise<TombstoneMap> {
  return loadTombstoneMap();
}

export async function getTaskDeletionTombstoneIds(): Promise<Set<string>> {
  const map = await loadTombstoneMap();
  return new Set(Object.keys(map));
}

/** Record a task deletion for LAN sync (call before saveData). */
export async function recordTaskDeletion(
  taskId: string,
  opts?: { groupId?: string; deletedAt?: string },
): Promise<void> {
  const id = String(taskId || '').trim();
  if (!id) return;
  const map = await loadTombstoneMap();
  const deletedAt = opts?.deletedAt ?? new Date().toISOString();
  const row: TaskDeletionTombstone = { id, deletedAt };
  if (opts?.groupId) row.groupId = String(opts.groupId);
  map[id] = row;
  await saveTombstoneMap(map);
}

function peerAckedDeletion(peer: SyncPeerRecord | null | undefined, tomb: TaskDeletionTombstone): boolean {
  if (!peer) return false;
  const delMs = tombstoneDeletedMs(tomb);
  if (!delMs) return false;
  const ackMs = peer.taskSyncedAt[tomb.id];
  return ackMs !== undefined && ackMs >= delMs;
}

/** Tombstones to send to a specific peer (until that peer has acked each deletion). */
export async function listTaskDeletionsForSync(
  sinceMs: number,
  scope: Set<string>,
  peer?: SyncPeerRecord | null,
): Promise<TaskDeletionTombstone[]> {
  if (!scope.size) return [];
  const map = await loadTombstoneMap();
  const out: TaskDeletionTombstone[] = [];
  for (const t of Object.values(map)) {
    if (t.groupId && !scope.has(t.groupId)) continue;
    if (peer) {
      if (peerAckedDeletion(peer, t)) continue;
    } else {
      const delMs = tombstoneDeletedMs(t);
      if (sinceMs > 0 && delMs > 0 && delMs <= sinceMs) continue;
    }
    out.push(t);
  }
  return out;
}

/** @deprecated Prefer pruneFullyAcknowledgedTaskDeletions. */
export async function pruneTaskDeletionTombstones(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const map = await loadTombstoneMap();
  let changed = false;
  for (const id of ids) {
    if (map[id]) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) await saveTombstoneMap(map);
}

/** Drop tombstones only after every contract peer has acked the deletion. */
export async function pruneFullyAcknowledgedTaskDeletions(
  peerStates: SyncPeerRecord[],
  contractPeerIds: string[],
): Promise<void> {
  if (!contractPeerIds.length) return;
  const map = await loadTombstoneMap();
  const peersById = new Map(
    peerStates.map((p) => [normalizeDeviceId(p.peerDeviceId), p] as const),
  );
  let changed = false;
  for (const [id, tomb] of Object.entries(map)) {
    const delMs = tombstoneDeletedMs(tomb);
    if (!delMs) continue;
    const allAcked = contractPeerIds.every((peerId) => {
      const peer = peersById.get(normalizeDeviceId(peerId));
      if (!peer) return false;
      const ackMs = peer.taskSyncedAt[id];
      return ackMs !== undefined && ackMs >= delMs;
    });
    if (allAcked) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) await saveTombstoneMap(map);
}

export async function mergeRemoteTaskDeletions(
  remote: TaskDeletionTombstone[] | undefined,
): Promise<TaskDeletionTombstone[]> {
  if (!remote?.length) return [];
  const map = await loadTombstoneMap();
  const applied: TaskDeletionTombstone[] = [];
  for (const r of remote) {
    const t = normalizeTombstone(r);
    if (!t) continue;
    const prev = map[t.id];
    if (!prev || Date.parse(t.deletedAt) >= Date.parse(prev.deletedAt)) {
      map[t.id] = t;
      applied.push(t);
    }
  }
  if (applied.length) await saveTombstoneMap(map);
  return applied;
}

/** True when a remote task payload must not resurrect a locally deleted id. */
export function isTaskBlockedByDeletionTombstone(
  taskId: string,
  taskUpdatedAt: string | undefined,
  tombstones: TombstoneMap,
): boolean {
  const tomb = tombstones[taskId];
  if (!tomb) return false;
  const delMs = tombstoneDeletedMs(tomb);
  if (!delMs) return true;
  const remoteMs = Date.parse(taskUpdatedAt ?? '');
  if (!Number.isFinite(remoteMs)) return true;
  return delMs >= remoteMs;
}
