import { GroupModel, type Group } from 'src/modules/group/models/GroupModel';
import { mergeGroupStyleFields, normalizeGroupStyleFields } from 'src/modules/group/utils/groupStyleUtils';
import type {
  LanSyncGroupDeletionPayload,
  LanSyncGroupPayload,
  LanSyncTaskDeletionPayload,
  LanSyncTaskPayload,
} from 'src/modules/lan/lanSyncAuth';
import {
  isTaskBlockedByDeletionTombstone,
  type TaskDeletionTombstone,
} from './taskDeletionLog';

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
      const style = normalizeGroupStyleFields({
        color: r.color,
        textColor: r.textColor,
      });
      if (style.color) init.color = style.color;
      if (style.textColor) init.textColor = style.textColor;
      if (r.icon !== undefined) init.icon = r.icon;
      if (r.backgroundImage !== undefined) init.backgroundImage = r.backgroundImage;
      if (r.layoutColorize !== undefined) init.layoutColorize = r.layoutColorize;
      if (r.backgroundColorize !== undefined) init.backgroundColorize = r.backgroundColorize;
      if (r.calendarColorize !== undefined) init.calendarColorize = r.calendarColorize;
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
      const mergedStyle = mergeGroupStyleFields(
        {
          ...(existing.color ? { color: existing.color } : {}),
          ...(existing.textColor ? { textColor: existing.textColor } : {}),
        },
        {
          ...(r.color ? { color: r.color } : {}),
          ...(r.textColor ? { textColor: r.textColor } : {}),
        },
      );
      Object.assign(existing, {
        name: r.name ?? existing.name,
        ...(mergedStyle.color ? { color: mergedStyle.color } : {}),
        icon: r.icon !== undefined ? r.icon : existing.icon,
        ...(mergedStyle.textColor ? { textColor: mergedStyle.textColor } : {}),
        backgroundImage:
          r.backgroundImage !== undefined ? r.backgroundImage : existing.backgroundImage,
        layoutColorize:
          r.layoutColorize !== undefined ? r.layoutColorize : existing.layoutColorize,
        backgroundColorize:
          r.backgroundColorize !== undefined
            ? r.backgroundColorize
            : existing.backgroundColorize,
        calendarColorize:
          r.calendarColorize !== undefined ? r.calendarColorize : existing.calendarColorize,
        parentId: r.parentId !== undefined ? (r.parentId ?? undefined) : existing.parentId,
        hideTasksFromParent:
          r.hideTasksFromParent !== undefined
            ? r.hideTasksFromParent
            : existing.hideTasksFromParent,
        shareSubgroups:
          r.shareSubgroups !== undefined ? r.shareSubgroups : existing.shareSubgroups,
        shortcut: r.shortcut !== undefined ? r.shortcut : existing.shortcut,
        updatedAt: r.updatedAt ?? existing.updatedAt,
      });
    }
  }
  return [...byId.values()];
}

/** Remove groups deleted on a peer when the tombstone is newer than the local row. */
export function applyGroupDeletionsToList(
  local: Group[],
  deletions: LanSyncGroupDeletionPayload[] | undefined,
): Group[] {
  if (!deletions?.length) return local;
  const byId = new Map(local.map((g) => [String(g.id), g]));
  const drop = new Set<string>();
  for (const d of deletions) {
    const id = String(d.id || '').trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) continue;
    const delMs = tsMs(d.deletedAt);
    const localMs = tsMs(existing.updatedAt);
    if (delMs >= localMs) drop.add(id);
  }
  if (!drop.size) return local;
  return local.filter((g) => !drop.has(String(g.id)));
}

/** Apply remote task deletions before merging task payloads. */
export function applyTaskDeletionsToFlatList(
  local: FlatTask[],
  deletions: LanSyncTaskDeletionPayload[] | undefined,
): FlatTask[] {
  if (!deletions?.length) return local;
  const drop = new Set<string>();
  const byId = new Map(local.map((t) => [String(t.id), t]));
  for (const d of deletions) {
    const id = String(d.id || '').trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      continue;
    }
    const delMs = tsMs(d.deletedAt);
    const localMs = tsMs(existing.updatedAt);
    if (delMs >= localMs) drop.add(id);
  }
  if (!drop.size) return local;
  return local.filter((t) => !drop.has(String(t.id)));
}

export type FlatTask = Record<string, unknown> & {
  id: string;
  updatedAt?: string;
  createdAt?: string;
};

export type OrganiserDayEntry = {
  date: string;
  tasks: FlatTask[];
  notes?: string;
};

function taskDateString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/** Calendar day key for a task (YYYY-MM-DD). */
export function taskDateKeyFromFlat(t: FlatTask): string {
  const raw = taskDateString(t.date) || taskDateString(t.eventDate);
  return raw.slice(0, 10) || new Date().toISOString().slice(0, 10);
}

/** Same task id → keep the row with the newest updatedAt; remote only overwrites fields it sends. */
export function mergeTasksByNewest(
  local: FlatTask[],
  remote: LanSyncTaskPayload[],
  deletionTombstones?: Record<string, TaskDeletionTombstone>,
): FlatTask[] {
  const byId = new Map(local.map((t) => [String(t.id), { ...t }]));
  for (const r of remote) {
    const id = String(r.id || '').trim();
    if (!id) continue;
    if (
      deletionTombstones &&
      isTaskBlockedByDeletionTombstone(id, r.updatedAt, deletionTombstones)
    ) {
      continue;
    }
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...r, id });
      continue;
    }
    const remoteMs = tsMs(r.updatedAt);
    const localMs = tsMs(existing.updatedAt);
    if (remoteMs > localMs || (remoteMs === localMs && remoteMs > 0)) {
      const patch: FlatTask = { id };
      for (const [key, value] of Object.entries(r)) {
        if (key === 'id' || value === undefined) continue;
        patch[key] = value;
      }
      byId.set(id, { ...existing, ...patch });
    }
  }
  return [...byId.values()];
}

/**
 * Rebuild day buckets from the merged task list (one row per task id).
 * Preserves per-day notes; does not drop tasks on a day that are absent from a sync delta.
 */
export function daysFromMergedTasks(
  existingDays: Record<string, OrganiserDayEntry>,
  mergedTasks: FlatTask[],
): Record<string, OrganiserDayEntry> {
  const byId = new Map<string, FlatTask>();
  for (const t of mergedTasks) {
    const id = String(t.id || '').trim();
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev || tsMs(t.updatedAt) >= tsMs(prev.updatedAt)) {
      byId.set(id, t);
    }
  }

  const byDate: Record<string, OrganiserDayEntry> = {};
  for (const t of byId.values()) {
    const dateKey = taskDateKeyFromFlat(t);
    if (!byDate[dateKey]) {
      const prev = existingDays[dateKey];
      byDate[dateKey] = { date: dateKey, tasks: [], notes: prev?.notes ?? '' };
    }
    byDate[dateKey].tasks.push(t);
  }

  for (const [dateKey, day] of Object.entries(existingDays)) {
    if (byDate[dateKey]) continue;
    const notes = String(day.notes ?? '').trim();
    if (notes) {
      byDate[dateKey] = { date: dateKey, tasks: [], notes: day.notes ?? '' };
    }
  }

  return byDate;
}

export async function groupPayloadFromLocalAsync(g: Group): Promise<LanSyncGroupPayload> {
  const p = groupPayloadFromLocal(g);
  const { readGroupBackgroundForSync } = await import(
    'src/modules/group/utils/groupBackgroundStorage'
  );
  const img = await readGroupBackgroundForSync(g.backgroundImage);
  if (img) p.backgroundImage = img;
  return p;
}

export function groupPayloadFromLocal(g: Group): LanSyncGroupPayload {
  const p: LanSyncGroupPayload = {
    id: String(g.id),
    name: g.name ?? '',
    parentId: g.parentId ?? null,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
  const style = normalizeGroupStyleFields({ color: g.color, textColor: g.textColor });
  if (style.color) p.color = style.color;
  if (g.icon !== undefined) p.icon = g.icon;
  if (style.textColor) p.textColor = style.textColor;
  if (g.backgroundImage !== undefined) p.backgroundImage = g.backgroundImage;
  if (g.layoutColorize !== undefined) p.layoutColorize = g.layoutColorize;
  if (g.backgroundColorize !== undefined) p.backgroundColorize = g.backgroundColorize;
  if (g.calendarColorize !== undefined) p.calendarColorize = g.calendarColorize;
  if (g.hideTasksFromParent !== undefined) p.hideTasksFromParent = g.hideTasksFromParent;
  if (g.shareSubgroups !== undefined) p.shareSubgroups = g.shareSubgroups;
  if (g.shortcut !== undefined) p.shortcut = g.shortcut;
  return p;
}

const TASK_SYNC_PAYLOAD_KEYS = [
  'id',
  'groupId',
  'name',
  'description',
  'date',
  'eventDate',
  'status_id',
  'type_id',
  'type',
  'priority',
  'category',
  'eventTime',
  'tags',
  'repeat',
  'timeMode',
  'timeOffsetDays',
  'color_set',
  'noteMode',
  'noteIcon',
  'noteColor',
  'photo',
  'attachments',
  'createdAt',
  'updatedAt',
] as const;

function plainTaskFields(t: FlatTask): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(t)) as Record<string, unknown>;
  } catch {
    return { ...(t as Record<string, unknown>) };
  }
}

function taskIdString(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

export function taskPayloadFromFlat(t: FlatTask): LanSyncTaskPayload {
  const raw = plainTaskFields(t);
  const out: LanSyncTaskPayload = { id: taskIdString(raw.id) || taskIdString(t.id) };
  for (const key of TASK_SYNC_PAYLOAD_KEYS) {
    if (key === 'id') continue;
    if (!(key in raw)) continue;
    const v = raw[key];
    if (v === undefined) continue;
    if (key === 'tags' && Array.isArray(v)) {
      out.tags = v.map((x) => String(x));
      continue;
    }
    if (key === 'repeat' && (v === null || (typeof v === 'object' && !Array.isArray(v)))) {
      out.repeat = v as Record<string, unknown> | null;
      continue;
    }
    if (key === 'status_id') {
      if (v !== undefined && v !== null) out.status_id = v as number | string;
      continue;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}
