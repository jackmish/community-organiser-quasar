import { patchCo21Settings, loadCo21Settings } from './roleProfileSettings';

export type GroupDeletionTombstone = {
  id: string;
  deletedAt: string;
};

type TombstoneMap = Record<string, GroupDeletionTombstone>;

const SETTINGS_KEY = 'deletedGroupTombstones';

function normalizeTombstone(raw: unknown): GroupDeletionTombstone | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as GroupDeletionTombstone;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const deletedAt = typeof o.deletedAt === 'string' ? o.deletedAt.trim() : '';
  if (!id || !deletedAt) return null;
  return { id, deletedAt };
}

async function loadTombstoneMap(): Promise<TombstoneMap> {
  const data = await loadCo21Settings();
  const raw = data[SETTINGS_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: TombstoneMap = {};
  for (const val of Object.values(raw)) {
    const t = normalizeTombstone(val);
    if (t) out[t.id] = t;
  }
  return out;
}

async function saveTombstoneMap(map: TombstoneMap): Promise<void> {
  await patchCo21Settings({ [SETTINGS_KEY]: map });
}

/** Record a group removal for LAN sync (call before persisting delete). */
export async function recordGroupDeletion(
  groupId: string,
  opts?: { deletedAt?: string },
): Promise<void> {
  const id = String(groupId || '').trim();
  if (!id) return;
  const map = await loadTombstoneMap();
  const deletedAt = opts?.deletedAt ?? new Date().toISOString();
  map[id] = { id, deletedAt };
  await saveTombstoneMap(map);
}

export async function listGroupDeletionsForSync(
  sinceMs: number,
  scope?: Set<string>,
): Promise<GroupDeletionTombstone[]> {
  // Match task tombstones: never send on baseline/full sync or without contract scope.
  if (sinceMs <= 0 || !scope?.size) return [];
  const map = await loadTombstoneMap();
  const out: GroupDeletionTombstone[] = [];
  for (const t of Object.values(map)) {
    const ts = Date.parse(t.deletedAt);
    if (Number.isFinite(ts) && ts <= sinceMs) continue;
    if (!scope.has(t.id)) continue;
    out.push(t);
  }
  return out;
}

export async function pruneGroupDeletionTombstones(ids: string[]): Promise<void> {
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

export async function mergeRemoteGroupDeletions(
  remote: GroupDeletionTombstone[] | undefined,
): Promise<GroupDeletionTombstone[]> {
  if (!remote?.length) return [];
  const map = await loadTombstoneMap();
  const applied: GroupDeletionTombstone[] = [];
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
