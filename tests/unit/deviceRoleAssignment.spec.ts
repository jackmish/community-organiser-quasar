import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveRole,
  rolesApplicableToGroup,
  type ConnectedDevice,
  type GroupRecord,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import type { RoleProfileData } from 'src/modules/storage/sync/RoleProfileModel';

const groups: GroupRecord[] = [
  { id: 'root', name: 'Root', parentId: null },
  { id: 'child', name: 'Child', parentId: 'root' },
];

const editorRole: RoleProfileData = {
  id: 'role-1',
  name: 'Editor',
  createdAt: 0,
  updatedAt: 0,
  groupAccess: [
    { groupId: 'root', enabled: true, accessRange: 'child', privilege: 'edit' },
    { groupId: 'child', enabled: false, accessRange: 'single', privilege: 'preview' },
  ],
};

describe('resolveEffectiveRole', () => {
  it('returns direct assignment on the same group', () => {
    const device: ConnectedDevice = {
      id: 'd1',
      name: 'Phone',
      rolesByGroup: { root: 'role-1' },
    };
    const eff = resolveEffectiveRole(device, groups, [editorRole], 'root');
    expect(eff?.kind).toBe('direct');
    expect(eff?.roleProfileId).toBe('role-1');
  });

  it('inherits from parent when range is children', () => {
    const device: ConnectedDevice = {
      id: 'd1',
      name: 'Phone',
      rolesByGroup: { root: 'role-1' },
    };
    const eff = resolveEffectiveRole(device, groups, [editorRole], 'child');
    expect(eff?.kind).toBe('inherited');
    expect(eff?.sourceGroupId).toBe('root');
    expect(eff?.sourceGroupName).toBe('Root');
  });
});

describe('rolesApplicableToGroup', () => {
  it('includes roles with enabled rule on group', () => {
    const roles = rolesApplicableToGroup([editorRole], groups, 'root');
    expect(roles.map((r) => r.id)).toContain('role-1');
  });
});
