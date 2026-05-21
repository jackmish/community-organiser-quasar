import { describe, it, expect } from 'vitest';
import {
  createDefaultRoleProfiles,
  DEFAULT_ROLE_PROFILE_IDS,
  ensureDefaultRoleProfiles,
} from 'src/modules/storage/sync/defaultRoleProfiles';
import { roleHasEnabledFunctions } from 'src/modules/storage/sync/roleFunctionCatalog';

describe('defaultRoleProfiles', () => {
  it('seeds four named roles with function access', () => {
    const roles = createDefaultRoleProfiles();
    expect(roles).toHaveLength(4);
    expect(roles.map((r) => r.name)).toEqual(['Owner', 'Editor', 'Task taker', 'Infoscreen']);
    expect(roles.every((r) => roleHasEnabledFunctions(r))).toBe(true);
    expect(roles[0]!.id).toBe(DEFAULT_ROLE_PROFILE_IDS.owner);
    expect(roles[0]!.accessRange).toBe('max');
  });

  it('ensureDefaultRoleProfiles leaves existing roles untouched', () => {
    const custom = createDefaultRoleProfiles().slice(0, 1);
    custom[0]!.name = 'Custom';
    expect(ensureDefaultRoleProfiles(custom)).toBe(custom);
  });

  it('ensureDefaultRoleProfiles fills when empty', () => {
    const seeded = ensureDefaultRoleProfiles([]);
    expect(seeded).toHaveLength(4);
  });
});
