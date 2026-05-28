import { patchCo21Settings, loadCo21Settings } from './roleProfileSettings';

export type TaskDeletionTombstone = {
  id: string;
  deletedAt: string;
  groupId?: string;
};

type TombstoneMap = Record<string, TaskDeletionTombstone>;

const SETTINGS_KEY = 'deletedTaskTombstones';

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

/** Tombstones to send on the next sync exchange (incremental watermark). */
export async function listTaskDeletionsForSync(
  sinceMs: number,
  scope: Set<string>,
): Promise<TaskDeletionTombstone[]> {
  // Baseline / first exchange after contract: tasks only (additive). Tombstones can
  // delete the peer's copy of ids that only existed locally on this device.
  if (sinceMs <= 0 || !scope.size) return [];
  const map = await loadTombstoneMap();
  const out: TaskDeletionTombstone[] = [];
  for (const t of Object.values(map)) {
    const ts = Date.parse(t.deletedAt);
    if (Number.isFinite(ts) && ts <= sinceMs) continue;
    if (t.groupId && !scope.has(t.groupId)) continue;
    out.push(t);
  }
  return out;
}

/** Drop tombstones after they were included in a successful exchange. */
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
