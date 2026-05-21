import logger from 'src/utils/logger';
import type { AccessRange, RolePrivilege } from './RoleModel';
import { PRIVILEGE_ORDER } from './RoleModel';
import type { RoleProfileData } from './RoleProfileModel';
import { loadCo21Settings } from './roleProfileSettings';
import { deviceId } from './deviceId';
import {
  maxPrivilegeFromProfile,
  roleHasEnabledFunctions,
  type RoleFunctionId,
} from './roleFunctionCatalog';

export type ConnectedDevice = {
  id: string;
  name: string;
  type?: string;
  lanHost?: string;
  /** This installation's device row. */
  isLocal?: boolean;
  /** groupId → roleProfileId (direct assignment on that group only) */
  rolesByGroup?: Record<string, string>;
  /** Default role profile for this device (Connections dialog). */
  defaultRoleProfileId?: string;
  /** Periodic sync interval (seconds) for this paired device. */
  syncIntervalSeconds?: number;
};

export type GroupRecord = {
  id: string;
  name: string;
  parentId: string | null;
};

export type EffectiveRoleAssignment = {
  roleProfileId: string;
  roleName: string;
  accessRange: AccessRange;
  privilege: RolePrivilege;
  kind: 'direct' | 'inherited' | 'default_full' | 'none';
  sourceGroupId: string;
  sourceGroupName: string;
};

/** Local device with no explicit role on a group — creator / owner default on this installation only. */
export function defaultFullAccessAssignment(
  groups: GroupRecord[],
  groupId: string,
): EffectiveRoleAssignment {
  return {
    roleProfileId: '',
    roleName: '',
    accessRange: 'max',
    privilege: 'full',
    kind: 'default_full',
    sourceGroupId: groupId,
    sourceGroupName: groupNameById(groups, groupId),
  };
}

/** Remote device with no role on a group — no shared access until explicitly assigned. */
export function noAccessAssignment(
  groups: GroupRecord[],
  groupId: string,
): EffectiveRoleAssignment {
  return {
    roleProfileId: '',
    roleName: '',
    accessRange: 'single',
    privilege: 'preview',
    kind: 'none',
    sourceGroupId: groupId,
    sourceGroupName: groupNameById(groups, groupId),
  };
}

export function resolveEffectiveRoleWithDefault(
  device: ConnectedDevice,
  groups: GroupRecord[],
  profiles: RoleProfileData[],
  targetGroupId: string,
): EffectiveRoleAssignment {
  const resolved = resolveEffectiveRole(device, groups, profiles, targetGroupId);
  if (resolved) return resolved;
  if (device.isLocal) {
    return defaultFullAccessAssignment(groups, targetGroupId);
  }
  return noAccessAssignment(groups, targetGroupId);
}

/** Role profile with the lowest privilege (for default “restrict” suggestion). */
export function pickDefaultRestrictiveRoleProfile(profiles: RoleProfileData[]): RoleProfileData | null {
  const applicable = profiles.filter((p) => roleHasEnabledFunctions(p));
  if (!applicable.length) return null;
  let best = applicable[0]!;
  let bestScore = PRIVILEGE_ORDER[maxPrivilegeFromProfile(best)];
  for (const p of applicable) {
    const score = PRIVILEGE_ORDER[maxPrivilegeFromProfile(p)];
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function sortRolesByRestrictiveness(profiles: RoleProfileData[]): RoleProfileData[] {
  return [...profiles].filter((p) => roleHasEnabledFunctions(p)).sort((a, b) => {
    return PRIVILEGE_ORDER[maxPrivilegeFromProfile(a)] - PRIVILEGE_ORDER[maxPrivilegeFromProfile(b)];
  });
}

export async function loadOwnDeviceMeta(): Promise<{ id: string; name: string }> {
  let id = deviceId.getSync() ?? '';
  if (!id) {
    try {
      id = await deviceId.get();
    } catch {
      id = '';
    }
  }
  const settings = await loadCo21Settings();
  const name =
    typeof settings.ownDeviceName === 'string' && settings.ownDeviceName.trim()
      ? settings.ownDeviceName.trim()
      : 'This device';
  if (!id) {
    id = await deviceId.get();
  }
  return { id, name };
}

function deviceRowMergeScore(d: ConnectedDevice): number {
  let score = 0;
  if ((d.lanHost || '').trim()) score += 10;
  if (d.rolesByGroup && Object.keys(d.rolesByGroup).length > 0) score += 5;
  if (d.defaultRoleProfileId) score += 2;
  if (typeof d.syncIntervalSeconds === 'number') score += 1;
  return score;
}

function mergePeerDeviceRows(primary: ConnectedDevice, secondary: ConnectedDevice): ConnectedDevice {
  const merged: ConnectedDevice = { ...primary };
  const host = (secondary.lanHost || '').trim();
  if (host && !(merged.lanHost || '').trim()) merged.lanHost = host;
  const name = (secondary.name || '').trim();
  if (name && !(merged.name || '').trim()) merged.name = secondary.name;
  if (secondary.rolesByGroup) {
    merged.rolesByGroup = { ...(merged.rolesByGroup ?? {}), ...secondary.rolesByGroup };
  }
  if (secondary.defaultRoleProfileId && !merged.defaultRoleProfileId) {
    merged.defaultRoleProfileId = secondary.defaultRoleProfileId;
  }
  if (
    typeof merged.syncIntervalSeconds !== 'number' &&
    typeof secondary.syncIntervalSeconds === 'number'
  ) {
    merged.syncIntervalSeconds = secondary.syncIntervalSeconds;
  }
  return merged;
}

/** Collapse duplicate LAN peers (same device id, different casing or stale rows). */
export function dedupeConnectedDevicesByPeerId(devices: ConnectedDevice[]): ConnectedDevice[] {
  const localNorm = devices.find((d) => d.isLocal)?.id;
  const localNormKey = localNorm ? normalizeDeviceId(localNorm) : '';
  const remoteByNorm = new Map<string, ConnectedDevice>();
  let localRow: ConnectedDevice | null = null;

  for (const d of devices) {
    if (d.isLocal) {
      if (!localRow || deviceRowMergeScore(d) >= deviceRowMergeScore(localRow)) {
        localRow = { ...d, isLocal: true, type: 'Local' };
      }
      continue;
    }
    const norm = normalizeDeviceId(d.id);
    if (!norm) continue;
    if (localNormKey && norm === localNormKey) continue;
    const prev = remoteByNorm.get(norm);
    if (!prev) {
      remoteByNorm.set(norm, { ...d });
      continue;
    }
    const primary =
      deviceRowMergeScore(prev) >= deviceRowMergeScore(d) ? prev : d;
    const secondary = primary === prev ? d : prev;
    remoteByNorm.set(norm, mergePeerDeviceRows(primary, secondary));
  }

  const remote = [...remoteByNorm.values()];
  if (localRow) return [localRow, ...remote];
  return remote;
}

export function mergeLocalDeviceIntoList(
  devices: ConnectedDevice[],
  local: { id: string; name: string },
): ConnectedDevice[] {
  const localNorm = normalizeDeviceId(local.id);
  const withoutSelfPeer = devices.filter(
    (d) => d.isLocal || normalizeDeviceId(d.id) !== localNorm,
  );
  const idx = withoutSelfPeer.findIndex(
    (d) => d.isLocal || normalizeDeviceId(d.id) === localNorm,
  );
  const row: ConnectedDevice = {
    id: local.id,
    name: local.name,
    type: 'Local',
    isLocal: true,
  };
  const prev = idx >= 0 ? withoutSelfPeer[idx] : undefined;
  if (prev?.rolesByGroup) row.rolesByGroup = { ...prev.rolesByGroup };
  if (idx < 0) return dedupeConnectedDevicesByPeerId([row, ...withoutSelfPeer]);
  const next = [...withoutSelfPeer];
  next[idx] = { ...withoutSelfPeer[idx]!, ...row };
  return dedupeConnectedDevicesByPeerId(next);
}

function stringField(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v.length ? v : fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fallback;
}

/** Case-insensitive compare for persisted vs LAN `/info` device ids. */
export function normalizeDeviceId(id: string): string {
  return String(id || '').trim().toLowerCase();
}

export function parseConnectedDevice(raw: Record<string, unknown>): ConnectedDevice {
  const id = stringField(raw.id, '') || stringField(raw.deviceId, '');
  const row: ConnectedDevice = {
    id,
    name: stringField(raw.name, id),
    type: stringField(raw.type, 'LAN'),
  };
  const lh = stringField(raw.lanHost, '');
  if (lh) row.lanHost = lh;
  const rbg = raw.rolesByGroup;
  if (rbg && typeof rbg === 'object' && !Array.isArray(rbg)) {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(rbg as Record<string, unknown>)) {
      const rid = stringField(v, '');
      if (k && rid) map[k] = rid;
    }
    if (Object.keys(map).length) row.rolesByGroup = map;
  }
  const defaultRole = stringField(raw.defaultRoleProfileId, '');
  if (defaultRole) row.defaultRoleProfileId = defaultRole;
  const syncSec = raw.syncIntervalSeconds;
  if (typeof syncSec === 'number' && Number.isFinite(syncSec)) {
    row.syncIntervalSeconds = Math.floor(syncSec);
  }
  if (raw.isLocal === true || raw.type === 'Local') row.isLocal = true;
  return row;
}

export function toDeviceJson(d: ConnectedDevice): Record<string, unknown> {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    ...(d.lanHost ? { lanHost: d.lanHost } : {}),
    ...(d.rolesByGroup && Object.keys(d.rolesByGroup).length
      ? { rolesByGroup: { ...d.rolesByGroup } }
      : {}),
    ...(d.defaultRoleProfileId ? { defaultRoleProfileId: d.defaultRoleProfileId } : {}),
    ...(typeof d.syncIntervalSeconds === 'number'
      ? { syncIntervalSeconds: d.syncIntervalSeconds }
      : {}),
    ...(d.isLocal ? { isLocal: true } : {}),
  };
}

export function normalizeGroupsFromCc(all: unknown[]): GroupRecord[] {
  return (all || []).map((g) => {
    const o = g as Record<string, unknown>;
    const pid = o.parentId ?? o.parent_id;
    return {
      id: stringField(o.id, ''),
      name: stringField(o.name, 'Group'),
      parentId:
        pid == null || pid === ''
          ? null
          : stringField(pid, ''),
    };
  }).filter((g) => g.id.length > 0);
}

export function groupNameById(groups: GroupRecord[], id: string): string {
  return groups.find((g) => g.id === id)?.name ?? id;
}

/** Ancestors from immediate parent up to root (excluding `groupId` itself). */
export function ancestorChain(groups: GroupRecord[], groupId: string): GroupRecord[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const chain: GroupRecord[] = [];
  let cur = byId.get(groupId);
  while (cur?.parentId) {
    const parent = byId.get(cur.parentId);
    if (!parent) break;
    chain.push(parent);
    cur = parent;
  }
  return chain;
}

export function isDescendantOf(groups: GroupRecord[], ancestorId: string, nodeId: string): boolean {
  if (ancestorId === nodeId) return false;
  const byId = new Map(groups.map((g) => [g.id, g]));
  let cur = byId.get(nodeId);
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

/** Roles that can be assigned on a group (any role with at least one function enabled). */
export function rolesApplicableToGroup(
  profiles: RoleProfileData[],
  _groups: GroupRecord[],
  _groupId: string,
): RoleProfileData[] {
  return profiles.filter((p) => roleHasEnabledFunctions(p));
}

function accessAppliesToTarget(
  accessRange: AccessRange,
  groups: GroupRecord[],
  assignmentGroupId: string,
  targetGroupId: string,
): boolean {
  if (assignmentGroupId === targetGroupId) return true;
  if (accessRange === 'single') return false;
  return isDescendantOf(groups, assignmentGroupId, targetGroupId);
}

/** Resolve device's effective role on `targetGroupId` (direct or inherited). */
export function resolveEffectiveRole(
  device: ConnectedDevice,
  groups: GroupRecord[],
  profiles: RoleProfileData[],
  targetGroupId: string,
): EffectiveRoleAssignment | null {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const directId = device.rolesByGroup?.[targetGroupId];
  if (directId) {
    const profile = profileById.get(directId);
    if (profile && roleHasEnabledFunctions(profile)) {
      return {
        roleProfileId: profile.id,
        roleName: profile.name,
        accessRange: profile.accessRange,
        privilege: maxPrivilegeFromProfile(profile),
        kind: 'direct',
        sourceGroupId: targetGroupId,
        sourceGroupName: groupNameById(groups, targetGroupId),
      };
    }
  }

  for (const anc of ancestorChain(groups, targetGroupId)) {
    const assignedRoleId = device.rolesByGroup?.[anc.id];
    if (!assignedRoleId) continue;
    const profile = profileById.get(assignedRoleId);
    if (!profile || !roleHasEnabledFunctions(profile)) continue;
    if (!accessAppliesToTarget(profile.accessRange, groups, anc.id, targetGroupId)) continue;
    return {
      roleProfileId: profile.id,
      roleName: profile.name,
      accessRange: profile.accessRange,
      privilege: maxPrivilegeFromProfile(profile),
      kind: 'inherited',
      sourceGroupId: anc.id,
      sourceGroupName: anc.name,
    };
  }
  return null;
}

export function devicesDirectlyOnRole(
  devices: ConnectedDevice[],
  groupId: string,
  roleProfileId: string,
): ConnectedDevice[] {
  return devices.filter((d) => d.rolesByGroup?.[groupId] === roleProfileId);
}

export function devicesInheritedOnRole(
  devices: ConnectedDevice[],
  groups: GroupRecord[],
  profiles: RoleProfileData[],
  groupId: string,
  roleProfileId: string,
): Array<{ device: ConnectedDevice; assignment: EffectiveRoleAssignment }> {
  const out: Array<{ device: ConnectedDevice; assignment: EffectiveRoleAssignment }> = [];
  for (const d of devices) {
    const eff = resolveEffectiveRole(d, groups, profiles, groupId);
    if (
      eff &&
      eff.kind === 'inherited' &&
      eff.roleProfileId === roleProfileId
    ) {
      out.push({ device: d, assignment: eff });
    }
  }
  return out;
}

/** Devices with no direct role on this group and not inheriting any role. */
export function devicesUnassignedOnGroup(
  devices: ConnectedDevice[],
  groups: GroupRecord[],
  profiles: RoleProfileData[],
  groupId: string,
): ConnectedDevice[] {
  return devices.filter((d) => !resolveEffectiveRole(d, groups, profiles, groupId));
}

export function roleProfileSummaryLabel(
  profile: RoleProfileData,
  labelRange: (r: AccessRange) => string,
  labelPriv: (p: RolePrivilege) => string,
  labelFunction: (functionId: RoleFunctionId) => string,
): string {
  const funcs = profile.functionAccess
    .filter((f) => f.enabled)
    .map((f) => `${labelFunction(f.functionId)}: ${labelPriv(f.privilege)}`);
  const range = labelRange(profile.accessRange);
  return funcs.length ? `${range} · ${funcs.join(', ')}` : range;
}

export function parseDevicesFromSettingsData(data: unknown): ConnectedDevice[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { devices?: unknown }).devices)) {
    return [];
  }
  const parsed = ((data as { devices: Record<string, unknown>[] }).devices).map(
    parseConnectedDevice,
  );
  return dedupeConnectedDevicesByPeerId(parsed);
}

/**
 * When saving, never drop paired remotes unless explicitly removed in Connections.
 * Incoming rows win field-level merges for the same peer id.
 */
export function mergeDeviceRegistryPreservingRemotes(
  incoming: ConnectedDevice[],
  onDisk: ConnectedDevice[],
  allowRemoteRemoval: boolean,
): ConnectedDevice[] {
  const merged = dedupeConnectedDevicesByPeerId(incoming);
  if (allowRemoteRemoval) return merged;

  const diskRemotes = onDisk.filter((d) => !d.isLocal);
  if (!diskRemotes.length) return merged;

  const incomingRemotes = merged.filter((d) => !d.isLocal);
  const incomingNorms = new Set(incomingRemotes.map((d) => normalizeDeviceId(d.id)));
  const lost = diskRemotes.filter((d) => !incomingNorms.has(normalizeDeviceId(d.id)));
  if (!lost.length) return merged;

  logger.warn(
    '[deviceRegistry] blocked removal of paired device(s); keeping on-disk remotes',
    lost.map((d) => d.name || d.id).join(', '),
  );

  const byNorm = new Map<string, ConnectedDevice>();
  for (const d of diskRemotes) {
    byNorm.set(normalizeDeviceId(d.id), { ...d });
  }
  for (const d of incomingRemotes) {
    const norm = normalizeDeviceId(d.id);
    const prev = byNorm.get(norm);
    byNorm.set(norm, prev ? mergePeerDeviceRows(prev, d) : { ...d });
  }

  const local =
    merged.find((d) => d.isLocal) ??
    onDisk.find((d) => d.isLocal) ??
    null;
  const localNorm = local ? normalizeDeviceId(local.id) : '';
  const remotes = [...byNorm.values()].filter(
    (d) => !localNorm || normalizeDeviceId(d.id) !== localNorm,
  );
  if (local) {
    return dedupeConnectedDevicesByPeerId([{ ...local, isLocal: true, type: 'Local' }, ...remotes]);
  }
  return dedupeConnectedDevicesByPeerId(remotes);
}

export type SaveConnectedDevicesOptions = {
  /** Set when the user explicitly removes a device in Connections. */
  allowRemoteRemoval?: boolean;
  ownDeviceName?: string;
};

export async function loadConnectedDevices(): Promise<ConnectedDevice[]> {
  try {
    const api = (window as unknown as { electronAPI?: Record<string, unknown> }).electronAPI;
    if (!api || typeof api.getAppDataPath !== 'function') return [];
    const appPath = await (api.getAppDataPath as () => Promise<string>)();
    const settingsDir = (api.joinPath as (a: string, b: string) => string)(appPath, 'co21');
    const settingsFile = (api.joinPath as (a: string, b: string) => string)(settingsDir, 'settings.json');
    const exists = await (api.fileExists as (p: string) => Promise<boolean>)(settingsFile);
    if (!exists) return [];
    const data = await (api.readJsonFile as (p: string) => Promise<unknown>)(settingsFile);
    if (!data || typeof data !== 'object' || !Array.isArray((data as { devices?: unknown }).devices)) {
      return [];
    }
    const parsed = ((data as { devices: Record<string, unknown>[] }).devices).map(
      parseConnectedDevice,
    );
    return dedupeConnectedDevicesByPeerId(parsed);
  } catch {
    return [];
  }
}

/** Sole API for persisting the Connections device registry (`co21/settings.json` → `devices`). */
export async function saveConnectedDevices(
  devices: ConnectedDevice[],
  opts?: SaveConnectedDevicesOptions,
): Promise<boolean> {
  try {
    const api = (window as unknown as { electronAPI?: Record<string, unknown> }).electronAPI;
    if (!api || typeof api.getAppDataPath !== 'function') return false;
    const appPath = await (api.getAppDataPath as () => Promise<string>)();
    const settingsDir = (api.joinPath as (a: string, b: string) => string)(appPath, 'co21');
    const settingsFile = (api.joinPath as (a: string, b: string) => string)(settingsDir, 'settings.json');
    await (api.ensureDir as (p: string) => Promise<void>)(settingsDir);
    const existing =
      ((await (api.readJsonFile as (p: string) => Promise<unknown>)(settingsFile)) as Record<
        string,
        unknown
      > | null) ?? {};
    const onDisk = parseDevicesFromSettingsData(existing);
    const toWrite = mergeDeviceRegistryPreservingRemotes(
      devices,
      onDisk,
      !!opts?.allowRemoteRemoval,
    );
    const payload = JSON.parse(
      JSON.stringify({
        ...existing,
        devices: toWrite.map(toDeviceJson),
        ...(opts?.ownDeviceName !== undefined ? { ownDeviceName: opts.ownDeviceName } : {}),
      }),
    ) as Record<string, unknown>;
    await (api.writeJsonFile as (p: string, d: unknown) => Promise<void>)(settingsFile, payload);
    return true;
  } catch (e) {
    logger.error('[deviceRegistry] saveConnectedDevices failed', e);
    return false;
  }
}
