import type { AccessRange } from './RoleModel';
import type { GroupRecord } from './deviceRoleAssignment';
import type { SyncContractSnapshot } from './syncContractSettings';

type RoleAssignmentDevice = { rolesByGroup?: Record<string, string> };

/** All descendant group ids under `ancestorId` (not including the ancestor). */
function descendantIds(groups: GroupRecord[], ancestorId: string): string[] {
  const byParent = new Map<string, string[]>();
  for (const g of groups) {
    const p = g.parentId;
    if (!p) continue;
    const list = byParent.get(p) ?? [];
    list.push(g.id);
    byParent.set(p, list);
  }
  const out: string[] = [];
  const queue = [...(byParent.get(ancestorId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    queue.push(...(byParent.get(id) ?? []));
  }
  return out;
}

function expandAssignmentGroupIds(
  groups: GroupRecord[],
  assignmentGroupId: string,
  accessRange: AccessRange,
): string[] {
  if (accessRange === 'single') return [assignmentGroupId];
  return [assignmentGroupId, ...descendantIds(groups, assignmentGroupId)];
}

function collectAssignedGroupIds(devices: RoleAssignmentDevice[]): Set<string> {
  const ids = new Set<string>();
  for (const dev of devices) {
    for (const gid of Object.keys(dev.rolesByGroup ?? {})) {
      if (gid) ids.add(gid);
    }
  }
  return ids;
}

function expandDevicesToGroupIds(
  devices: RoleAssignmentDevice[],
  groups: GroupRecord[],
  profileById: Map<string, { accessRange?: string }>,
): Set<string> {
  const expanded = new Set<string>();
  for (const dev of devices) {
    for (const [gid, profileId] of Object.entries(dev.rolesByGroup ?? {})) {
      if (!gid || !profileId) continue;
      const profile = profileById.get(profileId);
      const range = (profile?.accessRange ?? 'single') as AccessRange;
      if (range !== 'single' && range !== 'child' && range !== 'max') continue;
      for (const id of expandAssignmentGroupIds(groups, gid, range)) {
        expanded.add(id);
      }
    }
  }
  return expanded;
}

/**
 * Group ids whose organiser data is shared under an active sync contract.
 * Expands each device's role assignment by profile accessRange (child/max → subgroups).
 * Empty assignment set → empty scope (caller treats empty as "no filter" / all groups).
 */
export function contractGroupIds(
  snapshot: SyncContractSnapshot,
  allGroups: GroupRecord[] = [],
  extraDevices: RoleAssignmentDevice[] = [],
): Set<string> {
  const devices: RoleAssignmentDevice[] = [...snapshot.devices, ...extraDevices];
  const assigned = collectAssignedGroupIds(devices);
  if (!assigned.size) return assigned;
  if (!allGroups.length) return assigned;

  const profileById = new Map(snapshot.roleProfiles.map((p) => [p.id, p]));
  const expanded = expandDevicesToGroupIds(devices, allGroups, profileById);
  return expanded.size ? expanded : assigned;
}
