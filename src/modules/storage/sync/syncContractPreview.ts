import { $text } from 'src/modules/lang';
import { darkenHex, getContrastColor } from 'src/utils/colorUtils';
import type { PrivilegeChange } from './RoleModel';
import { PRIVILEGE_ORDER, roleAccessScore, type AccessRange, type RolePrivilege } from './RoleModel';
import type { RoleProfileData } from './RoleProfileModel';
import { maxPrivilegeFromProfile, syncFunctionAccess, type RoleFunctionId } from './roleFunctionCatalog';
import {
  DEFAULT_SYNC_DUPLICATE_RESOLUTION,
  normalizeSyncDuplicateResolution,
  type SyncDuplicateResolution,
  type SyncContractSnapshot,
} from './syncContractSettings';
import {
  normalizeGroupsFromCc,
  resolveEffectiveRole,
  roleProfileSummaryLabel,
  type ConnectedDevice,
  type GroupRecord,
} from './deviceRoleAssignment';
import { labelRolePrivilege } from './rolePrivilegeLabels';

export type SyncGroupVisual = {
  id: string;
  name: string;
  icon: string;
  color?: string;
};

export type SyncGroupChip = {
  group: SyncGroupVisual;
  taskCount: number;
  tasksEnabled: boolean;
};

export type SyncInheritedBundle = {
  sourceGroup: SyncGroupVisual;
  groups: SyncGroupChip[];
};

export type SyncPreviewSection = {
  deviceNames: string[];
  headline: string;
  roleName: string;
  directGroups: SyncGroupChip[];
  inherited: SyncInheritedBundle[];
};

export type SyncContractPreview = {
  isFirstContract: boolean;
  sections: SyncPreviewSection[];
  assignmentChanges: AssignmentChangeLine[];
  privilegeChanges: PrivilegeChange[];
};

export type AssignmentChangeLine = {
  deviceName: string;
  groupName: string;
  fromLabel: string;
  toLabel: string;
};

function labelRange(r: AccessRange): string {
  if (r === 'single') return $text('role.range_strict');
  if (r === 'child') return $text('role.range_children');
  return $text('role.range_all');
}

function labelFunction(functionId: RoleFunctionId): string {
  const key = `func.${functionId}`;
  const t = $text(key);
  return t !== key ? t : functionId;
}

function profileScore(profile: RoleProfileData): number {
  return roleAccessScore(maxPrivilegeFromProfile(profile), profile.accessRange);
}

function fmt(key: string, vars: Record<string, string>): string {
  let s = $text(key);
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(v);
  }
  return s;
}

function tasksEnabledOnProfile(profile: RoleProfileData): boolean {
  return !!syncFunctionAccess(profile.functionAccess).find((f) => f.functionId === 'tasks')?.enabled;
}

function makeGroupChip(
  group: SyncGroupVisual,
  profile: RoleProfileData,
  taskCount: number,
): SyncGroupChip {
  return {
    group,
    taskCount,
    tasksEnabled: tasksEnabledOnProfile(profile),
  };
}

function buildGroupVisualMap(groupsRaw: unknown): Map<string, SyncGroupVisual> {
  const map = new Map<string, SyncGroupVisual>();
  const list = Array.isArray(groupsRaw) ? groupsRaw : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Record<string, unknown>;
    const id = typeof g.id === 'string' || typeof g.id === 'number' ? String(g.id) : '';
    if (!id) continue;
    const name =
      typeof g.name === 'string'
        ? g.name
        : typeof g.label === 'string'
          ? g.label
          : id;
    const icon = typeof g.icon === 'string' && g.icon ? g.icon : 'folder';
    const color = typeof g.color === 'string' && g.color ? g.color : undefined;
    const row: SyncGroupVisual = { id, name, icon };
    if (color) row.color = color;
    map.set(id, row);
  }
  return map;
}

function groupVisual(
  groupId: string,
  groups: GroupRecord[],
  visualMap: Map<string, SyncGroupVisual>,
): SyncGroupVisual {
  const fromCc = visualMap.get(groupId);
  if (fromCc) return fromCc;
  const rec = groups.find((g) => g.id === groupId);
  return {
    id: groupId,
    name: rec?.name ?? groupId,
    icon: 'folder',
  };
}

function labelExplicitAccess(
  device: ConnectedDevice,
  rolesByGroup: Record<string, string>,
  groups: GroupRecord[],
  profiles: RoleProfileData[],
  groupId: string,
): string {
  const eff = resolveEffectiveRole({ ...device, rolesByGroup }, groups, profiles, groupId);
  if (!eff) return $text('sync.contract_no_access');
  return `${eff.roleName} (${labelRolePrivilege(eff.privilege)})`;
}

export function buildSyncContractSnapshot(
  devices: ConnectedDevice[],
  profiles: RoleProfileData[],
  duplicateResolution: SyncDuplicateResolution = DEFAULT_SYNC_DUPLICATE_RESOLUTION,
  groupsRaw?: unknown[],
  taskCountByGroup?: Record<string, number>,
): SyncContractSnapshot {
  const assignedGroupIds = new Set<string>();
  for (const d of devices) {
    if (d.rolesByGroup) {
      for (const gid of Object.keys(d.rolesByGroup)) assignedGroupIds.add(gid);
    }
  }

  const groups: SyncContractSnapshot['groups'] = [];
  if (Array.isArray(groupsRaw)) {
    for (const item of groupsRaw) {
      if (!item || typeof item !== 'object') continue;
      const g = item as Record<string, unknown>;
      const id = typeof g.id === 'string' || typeof g.id === 'number' ? String(g.id) : '';
      if (!id || !assignedGroupIds.has(id)) continue;
      const name = typeof g.name === 'string' && g.name ? g.name : id;
      const entry: { id: string; name: string; icon?: string; color?: string; parentId?: string | null; taskCount?: number } = { id, name };
      if (typeof g.icon === 'string' && g.icon) entry.icon = g.icon;
      if (typeof g.color === 'string' && g.color) entry.color = g.color;
      const pid = g.parentId ?? g.parent_id;
      if (typeof pid === 'string' && pid) entry.parentId = pid;
      else entry.parentId = null;
      const tc = taskCountByGroup?.[id];
      if (typeof tc === 'number' && tc > 0) entry.taskCount = tc;
      groups.push(entry);
    }
  }

  return {
    savedAt: Date.now(),
    duplicateResolution: normalizeSyncDuplicateResolution(duplicateResolution),
    devices: devices
      .filter((d) => !d.isLocal)
      .map((d) => ({
        id: d.id,
        name: d.name,
        rolesByGroup: { ...(d.rolesByGroup ?? {}) },
      })),
    roleProfiles: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      accessRange: p.accessRange,
      updatedAt: p.updatedAt,
      functionAccess: syncFunctionAccess(p.functionAccess).map((f) => ({
        functionId: f.functionId,
        enabled: f.enabled,
        privilege: f.privilege,
      })),
    })),
    groups,
  };
}

function sortRolesByGroup(rolesByGroup: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const gid of Object.keys(rolesByGroup).sort()) {
    out[gid] = rolesByGroup[gid]!;
  }
  return out;
}

/** Contract terms only (ignores volatile fields like savedAt / profile updatedAt / device display names). */
function normalizeContractSnapshotForCompare(snap: SyncContractSnapshot) {
  return {
    duplicateResolution: normalizeSyncDuplicateResolution(snap.duplicateResolution),
    devices: [...snap.devices]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((d) => ({
        id: d.id,
        rolesByGroup: sortRolesByGroup(d.rolesByGroup ?? {}),
      })),
    roleProfiles: [...snap.roleProfiles]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        accessRange: p.accessRange,
        functionAccess: [...p.functionAccess]
          .sort((a, b) => a.functionId.localeCompare(b.functionId))
          .map((f) => ({
            functionId: f.functionId,
            enabled: f.enabled,
            privilege: f.privilege,
          })),
      })),
  };
}

function snapshotsEqual(a: SyncContractSnapshot | null, b: SyncContractSnapshot): boolean {
  if (!a) return false;
  return (
    JSON.stringify(normalizeContractSnapshotForCompare(a)) ===
    JSON.stringify(normalizeContractSnapshotForCompare(b))
  );
}

export function hasSnapshotChanges(
  previous: SyncContractSnapshot | null,
  current: SyncContractSnapshot,
): boolean {
  return !snapshotsEqual(previous, current);
}

/**
 * True when there are sync-contract terms to propose to remote device(s):
 * role assignments, role definitions, or duplicate-handling — not snapshot timestamps.
 */
export function hasMeaningfulContractChanges(
  previous: SyncContractSnapshot | null,
  current: SyncContractSnapshot,
  devices: ConnectedDevice[],
): boolean {
  if (!previous) return false;
  if (!devices.some((d) => !d.isLocal)) return false;
  return hasSnapshotChanges(previous, current);
}

export function computeAssignmentChanges(
  previous: SyncContractSnapshot | null,
  current: SyncContractSnapshot,
  groups: GroupRecord[],
  devices: ConnectedDevice[],
  profiles: RoleProfileData[],
): AssignmentChangeLine[] {
  const lines: AssignmentChangeLine[] = [];
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id;
  const deviceName = (id: string) => devices.find((d) => d.id === id)?.name ?? id;

  const prevByDevice = new Map((previous?.devices ?? []).map((d) => [d.id, d.rolesByGroup]));
  for (const cur of current.devices) {
    const prevRoles = prevByDevice.get(cur.id) ?? {};
    const allGroupIds = new Set([...Object.keys(prevRoles), ...Object.keys(cur.rolesByGroup)]);
    const dev = devices.find((d) => d.id === cur.id);
    if (!dev) continue;
    for (const gid of allGroupIds) {
      const prevId = prevRoles[gid];
      const nextId = cur.rolesByGroup[gid];
      if (prevId === nextId) continue;
      lines.push({
        deviceName: deviceName(cur.id),
        groupName: groupName(gid),
        fromLabel: labelExplicitAccess(dev, prevRoles, groups, profiles, gid),
        toLabel: labelExplicitAccess(dev, cur.rolesByGroup, groups, profiles, gid),
      });
    }
  }
  return lines;
}

export function computeProfilePrivilegeChanges(
  previous: SyncContractSnapshot | null,
  current: SyncContractSnapshot,
): PrivilegeChange[] {
  if (!previous) return [];
  const changes: PrivilegeChange[] = [];
  const prevById = new Map(previous.roleProfiles.map((p) => [p.id, p]));
  for (const cur of current.roleProfiles) {
    const prev = prevById.get(cur.id);
    if (!prev) {
      changes.push({
        roleName: cur.name,
        changeType: 'extension',
        fromLabel: $text('sync.contract_role_new'),
        toLabel: cur.name,
      });
      continue;
    }
    const oldProfile = snapshotProfileToData(prev);
    const newProfile = snapshotProfileToData(cur);
    const oldScore = profileScore(oldProfile);
    const newScore = profileScore(newProfile);
    if (oldScore === newScore) continue;
    const fromLabel = roleProfileSummaryLabel(
      oldProfile,
      labelRange,
      labelRolePrivilege,
      labelFunction,
    );
    const toLabel = roleProfileSummaryLabel(
      newProfile,
      labelRange,
      labelRolePrivilege,
      labelFunction,
    );
    changes.push({
      roleName: cur.name,
      changeType: newScore < oldScore ? 'reduction' : 'extension',
      fromLabel,
      toLabel,
    });
  }
  for (const prev of previous.roleProfiles) {
    if (!current.roleProfiles.find((c) => c.id === prev.id)) {
      changes.push({
        roleName: prev.name,
        changeType: 'reduction',
        fromLabel: roleProfileSummaryLabel(
          snapshotProfileToData(prev),
          labelRange,
          labelRolePrivilege,
          labelFunction,
        ),
        toLabel: $text('sync.contract_role_removed'),
      });
    }
  }
  return changes;
}

function snapshotProfileToData(
  p: SyncContractSnapshot['roleProfiles'][number],
): RoleProfileData {
  return {
    id: p.id,
    name: p.name,
    accessRange: p.accessRange as AccessRange,
    functionAccess: p.functionAccess.map((f) => ({
      functionId: f.functionId as RoleFunctionId,
      enabled: f.enabled,
      privilege: f.privilege as RolePrivilege,
    })),
    createdAt: 0,
    updatedAt: p.updatedAt,
  };
}

type RoleAggregate = {
  roleProfileId: string;
  roleName: string;
  deviceNames: Set<string>;
  direct: Map<string, SyncGroupChip>;
  inherited: Map<string, { sourceGroup: SyncGroupVisual; groups: Map<string, SyncGroupChip> }>;
};

function headlineForRole(
  roleName: string,
  directGroupIds: string[],
  groups: GroupRecord[],
  assignmentChanges: AssignmentChangeLine[],
): string {
  for (const gid of directGroupIds) {
    const change = assignmentChanges.find((c) => c.groupName === groupNameById(groups, gid));
    if (change) {
      return fmt('sync.preview_role_changed', {
        group: change.groupName,
        from: change.fromLabel,
        to: change.toLabel,
      });
    }
  }
  const firstGroup = directGroupIds[0];
  if (firstGroup) {
    return fmt('sync.preview_role_for_group', {
      role: roleName,
      group: groupNameById(groups, firstGroup),
    });
  }
  return roleName;
}

function groupNameById(groups: GroupRecord[], id: string): string {
  return groups.find((g) => g.id === id)?.name ?? id;
}

function buildPreviewSections(
  remoteDevices: ConnectedDevice[],
  groups: GroupRecord[],
  profiles: RoleProfileData[],
  visualMap: Map<string, SyncGroupVisual>,
  taskCountByGroup: Record<string, number>,
  assignmentChanges: AssignmentChangeLine[],
): SyncPreviewSection[] {
  const byRole = new Map<string, RoleAggregate>();

  for (const dev of remoteDevices) {
    for (const g of groups) {
      const eff = resolveEffectiveRole(dev, groups, profiles, g.id);
      if (!eff) continue;
      const profile = profiles.find((p) => p.id === eff.roleProfileId);
      if (!profile) continue;

      let agg = byRole.get(eff.roleProfileId);
      if (!agg) {
        agg = {
          roleProfileId: eff.roleProfileId,
          roleName: eff.roleName,
          deviceNames: new Set(),
          direct: new Map(),
          inherited: new Map(),
        };
        byRole.set(eff.roleProfileId, agg);
      }
      agg.deviceNames.add(dev.name);

      const chip = makeGroupChip(
        groupVisual(g.id, groups, visualMap),
        profile,
        taskCountByGroup[g.id] ?? 0,
      );

      if (eff.kind === 'direct') {
        agg.direct.set(g.id, chip);
        continue;
      }

      if (eff.kind === 'inherited') {
        const sourceId = eff.sourceGroupId;
        let bundle = agg.inherited.get(sourceId);
        if (!bundle) {
          bundle = {
            sourceGroup: groupVisual(sourceId, groups, visualMap),
            groups: new Map(),
          };
          agg.inherited.set(sourceId, bundle);
        }
        bundle.groups.set(g.id, chip);
      }
    }
  }

  const sections: SyncPreviewSection[] = [];
  for (const agg of byRole.values()) {
    if (!agg.direct.size && !agg.inherited.size) continue;

    const directGroups = [...agg.direct.values()].sort((a, b) =>
      a.group.name.localeCompare(b.group.name),
    );
    const directIds = [...agg.direct.keys()];
    const inherited: SyncInheritedBundle[] = [...agg.inherited.values()]
      .map((b) => ({
        sourceGroup: b.sourceGroup,
        groups: [...b.groups.values()].sort((a, b) => a.group.name.localeCompare(b.group.name)),
      }))
      .sort((a, b) => a.sourceGroup.name.localeCompare(b.sourceGroup.name));

    sections.push({
      deviceNames: [...agg.deviceNames].sort((a, b) => a.localeCompare(b)),
      headline: headlineForRole(agg.roleName, directIds, groups, assignmentChanges),
      roleName: agg.roleName,
      directGroups,
      inherited,
    });
  }

  return sections.sort((a, b) => a.roleName.localeCompare(b.roleName));
}

/** Short chip label — group name only. */
export function syncGroupChipLabel(chip: SyncGroupChip): string {
  return chip.group.name;
}

/** Match `GroupButton` colors (task list group shortcuts). */
export function syncGroupChipButtonStyle(group: SyncGroupVisual): {
  wrap: Record<string, string>;
  icon: Record<string, string>;
} {
  const base = group.color || '#e0e0e0';
  const border = group.color ? darkenHex(group.color, 0.35) : 'rgba(0, 0, 0, 0.12)';
  const text = group.color ? getContrastColor(group.color) : 'rgba(0, 0, 0, 0.87)';
  return {
    wrap: {
      backgroundColor: base,
      border: `1px solid ${border}`,
      color: text,
    },
    icon: { color: text },
  };
}

export function syncInheritedScopeText(sourceGroup: SyncGroupVisual): string {
  return fmt('sync.preview_inherited_scope', { group: sourceGroup.name });
}

/**
 * Fill in group records, visual entries, and task counts from a snapshot's
 * embedded `groups` metadata for any data not already present locally.
 */
function mergeSnapshotGroupsInto(
  snapshot: SyncContractSnapshot,
  groups: GroupRecord[],
  visualMap: Map<string, SyncGroupVisual>,
  taskCountByGroup?: Record<string, number>,
): void {
  if (!snapshot.groups?.length) return;
  const knownIds = new Set(groups.map((g) => g.id));
  for (const sg of snapshot.groups) {
    if (!knownIds.has(sg.id)) {
      groups.push({ id: sg.id, name: sg.name, parentId: sg.parentId ?? null });
      knownIds.add(sg.id);
    }
    if (!visualMap.has(sg.id)) {
      const vis: SyncGroupVisual = { id: sg.id, name: sg.name, icon: sg.icon || 'folder' };
      if (sg.color) vis.color = sg.color;
      visualMap.set(sg.id, vis);
    }
    if (taskCountByGroup && typeof sg.taskCount === 'number' && sg.taskCount > 0) {
      if (!taskCountByGroup[sg.id]) taskCountByGroup[sg.id] = sg.taskCount;
    }
  }
}

export type BuildSyncContractPreviewOptions = {
  /** Incoming peer contract: show roles for all devices in the proposal (including this device). */
  includeAllDevicesInSections?: boolean;
};

export function buildSyncContractPreview(
  previous: SyncContractSnapshot | null,
  current: SyncContractSnapshot,
  devices: ConnectedDevice[],
  profiles: RoleProfileData[],
  groupsRaw: unknown,
  taskCountByGroup: Record<string, number>,
  options?: BuildSyncContractPreviewOptions,
): SyncContractPreview {
  const groups = normalizeGroupsFromCc(Array.isArray(groupsRaw) ? groupsRaw : []);
  const visualMap = buildGroupVisualMap(groupsRaw);

  mergeSnapshotGroupsInto(current, groups, visualMap, taskCountByGroup);
  if (previous) mergeSnapshotGroupsInto(previous, groups, visualMap, taskCountByGroup);

  const sectionDevices = options?.includeAllDevicesInSections
    ? devices
    : devices.filter((d) => !d.isLocal);

  return {
    isFirstContract: !previous,
    sections: buildPreviewSections(
      sectionDevices,
      groups,
      profiles,
      visualMap,
      taskCountByGroup,
      computeAssignmentChanges(previous, current, groups, devices, profiles),
    ),
    assignmentChanges: computeAssignmentChanges(previous, current, groups, devices, profiles),
    privilegeChanges: computeProfilePrivilegeChanges(previous, current),
  };
}
