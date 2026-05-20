import { describe, it, expect } from 'vitest';
import {
  syncGroupAccessWithIds,
  defaultGroupAccessRule,
  flattenGroupTree,
} from 'src/modules/storage/sync/RoleProfileModel';

describe('syncGroupAccessWithIds', () => {
  it('preserves existing rules and adds defaults for new groups', () => {
    const existing = [{ ...defaultGroupAccessRule('a'), enabled: true, privilege: 'edit' as const }];
    const synced = syncGroupAccessWithIds(existing, ['a', 'b']);
    expect(synced).toHaveLength(2);
    expect(synced[0]!.enabled).toBe(true);
    expect(synced[0]!.privilege).toBe('edit');
    expect(synced[1]!.groupId).toBe('b');
    expect(synced[1]!.enabled).toBe(false);
  });
});

describe('flattenGroupTree', () => {
  it('flattens nested children with depth', () => {
    const rows = flattenGroupTree([
      {
        id: 'root',
        name: 'Root',
        children: [{ id: 'child', name: 'Child', children: [] }],
      },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['root', 'child']);
    expect(rows[1]!.depth).toBe(1);
  });
});
