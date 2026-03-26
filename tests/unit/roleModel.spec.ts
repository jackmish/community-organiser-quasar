import { describe, it, expect } from 'vitest';
import {
  roleAccessScore,
  computeRoleChanges,
  CREATOR_ACCESS_SCORE,
  Role,
} from 'src/modules/storage/sync/RoleModel';
import type { RoleData } from 'src/modules/storage/sync/RoleModel';

// Builds a RoleData with a predictable id
function r(
  id: string,
  privilege: RoleData['privilege'],
  accessRange: RoleData['accessRange'],
  name = 'Role',
): RoleData {
  return { ...Role.create(name, 'g1', accessRange, privilege).toJSON(), id };
}

const LABEL_FN = (priv: RoleData['privilege'], range: RoleData['accessRange']) =>
  `${priv}/${range}`;
const CREATOR_LABEL = 'Creator';

describe('roleAccessScore', () => {
  it('preview/single is the lowest score', () => {
    expect(roleAccessScore('preview', 'single')).toBe(11);
  });

  it('full/max is the highest explicit score, equal to CREATOR_ACCESS_SCORE', () => {
    expect(roleAccessScore('full', 'max')).toBe(CREATOR_ACCESS_SCORE);
  });

  it('scores increase with privilege level', () => {
    expect(roleAccessScore('edit', 'single')).toBeGreaterThan(roleAccessScore('preview', 'single'));
    expect(roleAccessScore('full', 'single')).toBeGreaterThan(roleAccessScore('edit', 'single'));
  });

  it('scores increase with access range within same privilege', () => {
    expect(roleAccessScore('preview', 'child')).toBeGreaterThan(
      roleAccessScore('preview', 'single'),
    );
    expect(roleAccessScore('preview', 'max')).toBeGreaterThan(roleAccessScore('preview', 'child'));
  });
});

describe('computeRoleChanges', () => {
  it('returns empty array when roles are identical', () => {
    const role = r('1', 'edit', 'child');
    expect(computeRoleChanges([role], [role], LABEL_FN, CREATOR_LABEL)).toHaveLength(0);
  });

  it('detects privilege reduction (privilege drops)', () => {
    const old = r('1', 'full', 'max');
    const updated = { ...old, privilege: 'preview' as const, accessRange: 'single' as const };
    const changes = computeRoleChanges([old], [updated], LABEL_FN, CREATOR_LABEL);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changeType).toBe('reduction');
    expect(changes[0]!.fromLabel).toBe('full/max');
    expect(changes[0]!.toLabel).toBe('preview/single');
  });

  it('detects privilege extension (privilege rises)', () => {
    const old = r('1', 'preview', 'single');
    const updated = { ...old, privilege: 'edit' as const, accessRange: 'child' as const };
    const changes = computeRoleChanges([old], [updated], LABEL_FN, CREATOR_LABEL);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changeType).toBe('extension');
  });

  it('marks new role creation as reduction from creator when below creator level', () => {
    const newRole = r('new', 'preview', 'single', 'Viewer');
    const changes = computeRoleChanges([], [newRole], LABEL_FN, CREATOR_LABEL);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changeType).toBe('reduction');
    expect(changes[0]!.fromLabel).toBe(CREATOR_LABEL);
  });

  it('marks new role with full/max as extension (same as creator)', () => {
    const newRole = r('new', 'full', 'max', 'Admin');
    const changes = computeRoleChanges([], [newRole], LABEL_FN, CREATOR_LABEL);
    // score equals CREATOR — no change
    expect(changes).toHaveLength(0);
  });

  it('marks role deletion as extension back to creator', () => {
    const old = r('1', 'edit', 'child');
    const changes = computeRoleChanges([old], [], LABEL_FN, CREATOR_LABEL);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changeType).toBe('extension');
    expect(changes[0]!.toLabel).toBe(CREATOR_LABEL);
    expect(changes[0]!.fromLabel).toBe('edit/child');
  });

  it('emits no change when only role name changes (same privilege+range)', () => {
    const old = r('1', 'edit', 'child', 'Old Name');
    const updated = { ...old, name: 'New Name' };
    const changes = computeRoleChanges([old], [updated], LABEL_FN, CREATOR_LABEL);
    expect(changes).toHaveLength(0);
  });

  it('handles mixed batch: one reduction and one extension', () => {
    const roleA = r('a', 'full', 'max');
    const roleB = r('b', 'preview', 'single');
    const updatedA = { ...roleA, privilege: 'preview' as const, accessRange: 'single' as const };
    const updatedB = { ...roleB, privilege: 'edit' as const, accessRange: 'child' as const };
    const changes = computeRoleChanges(
      [roleA, roleB],
      [updatedA, updatedB],
      LABEL_FN,
      CREATOR_LABEL,
    );
    expect(changes).toHaveLength(2);
    const types = changes.map((c) => c.changeType).sort();
    expect(types).toEqual(['extension', 'reduction']);
  });
});
