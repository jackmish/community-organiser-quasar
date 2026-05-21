import { GroupModel, type Group } from 'src/modules/group/models/GroupModel';
import type { LanSyncGroupPayload, LanSyncTaskPayload } from 'src/modules/lan/lanSyncAuth';

function tsMs(v: string | undefined): number {
  if (!v) return 0;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

/** Same id → one group; same name with different id → keep both (contract uses ids). */
export function mergeGroupsById(local: Group[], remote: LanSyncGroupPayload[]): Group[] {
  const byId = new Map(local.map((g) => [String(g.id), g]));
  for (const r of remote) {
    const id = String(r.id || '').trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      const init: Partial<GroupModel> & { id: string; name: string } = {
        id,
        name: r.name ?? '',
      };
      if (r.color !== undefined) init.color = r.color;
      if (r.icon !== undefined) init.icon = r.icon;
      if (r.parentId != null) init.parentId = r.parentId ?? undefined;
      if (r.hideTasksFromParent !== undefined) init.hideTasksFromParent = r.hideTasksFromParent;
      if (r.shareSubgroups !== undefined) init.shareSubgroups = r.shareSubgroups;
      if (r.shortcut !== undefined) init.shortcut = r.shortcut;
      if (r.createdAt) init.createdAt = r.createdAt;
      if (r.updatedAt) init.updatedAt = r.updatedAt;
      byId.set(id, new GroupModel(init));
      continue;
    }
    const remoteMs = tsMs(r.updatedAt);
    const localMs = tsMs(existing.updatedAt);
    if (remoteMs >= localMs) {
      Object.assign(existing, {
        name: r.name ?? existing.name,
        color: r.color ?? existing.color,
        icon: r.icon ?? existing.icon,
        parentId: r.parentId ?? existing.parentId,
        hideTasksFromParent: r.hideTasksFromParent ?? existing.hideTasksFromParent,
        shareSubgroups: r.shareSubgroups ?? existing.shareSubgroups,
        shortcut: r.shortcut ?? existing.shortcut,
        updatedAt: r.updatedAt ?? existing.updatedAt,
      });
    }
  }
  return [...byId.values()];
}

export type FlatTask = Record<string, unknown> & {
  id: string;
  updatedAt?: string;
  createdAt?: string;
};

/** Same task id → keep the row with the newest updatedAt (no field-level merge). */
export function mergeTasksByNewest(local: FlatTask[], remote: LanSyncTaskPayload[]): FlatTask[] {
  const byId = new Map(local.map((t) => [String(t.id), { ...t }]));
  for (const r of remote) {
    const id = String(r.id || '').trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...r, id });
      continue;
    }
    const remoteMs = tsMs(r.updatedAt);
    const localMs = tsMs(existing.updatedAt);
    if (remoteMs >= localMs) {
      byId.set(id, { ...existing, ...r, id });
    }
  }
  return [...byId.values()];
}

export function groupPayloadFromLocal(g: Group): LanSyncGroupPayload {
  const p: LanSyncGroupPayload = {
    id: String(g.id),
    name: g.name ?? '',
    parentId: g.parentId ?? null,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
  if (g.color !== undefined) p.color = g.color;
  if (g.icon !== undefined) p.icon = g.icon;
  if (g.hideTasksFromParent !== undefined) p.hideTasksFromParent = g.hideTasksFromParent;
  if (g.shareSubgroups !== undefined) p.shareSubgroups = g.shareSubgroups;
  if (g.shortcut !== undefined) p.shortcut = g.shortcut;
  return p;
}

export function taskPayloadFromFlat(t: FlatTask): LanSyncTaskPayload {
  return { ...t, id: String(t.id) } as LanSyncTaskPayload;
}
