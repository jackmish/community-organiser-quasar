import { describe, it, expect } from 'vitest';
import {
  addGroup,
  updateGroup,
  deleteGroup,
  getParentForActive,
  prepareGroupsForSave,
} from '../../src/modules/group/managers/groupManager';
import { GroupModel } from '../../src/modules/group/models/GroupModel';

// ─── addGroup ─────────────────────────────────────────────────────────────────
describe('addGroup', () => {
  it('creates a group with the given name and returns it', () => {
    const data: any = { groups: [], days: {} };
    const g = addGroup(data, { name: 'Work' });
    expect(g.name).toBe('Work');
    expect(g.id).toBeTruthy();
    expect(g.createdAt).toBeTruthy();
  });

  it('pushes the new group into data.groups', () => {
    const data: any = { groups: [], days: {} };
    addGroup(data, { name: 'Home' });
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].name).toBe('Home');
  });

  it('stores optional fields when provided', () => {
    const data: any = { groups: [], days: {} };
    const g = addGroup(data, { name: 'G', color: '#ff0000', icon: 'star', parentId: 'p1' });
    expect(g.color).toBe('#ff0000');
    expect(g.icon).toBe('star');
    expect(g.parentId).toBe('p1');
  });

  it('also works when an array is passed instead of an organiserData object', () => {
    const arr: any[] = [];
    const g = addGroup(arr, { name: 'Direct' });
    expect(arr).toHaveLength(1);
    expect(arr[0]).toBe(g);
  });

  it('initialises data.groups when it is absent', () => {
    const data: any = { days: {} };
    addGroup(data, { name: 'Init' });
    expect(Array.isArray(data.groups)).toBe(true);
    expect(data.groups).toHaveLength(1);
  });
});

// ─── updateGroup ─────────────────────────────────────────────────────────────
describe('updateGroup', () => {
  it('updates mutable fields of an existing group', () => {
    const data: any = { groups: [], days: {} };
    const g = addGroup(data, { name: 'Old Name', color: '#aaaaaa' });
    updateGroup(data, g.id, { name: 'New Name', color: '#bbbbbb' });
    expect(data.groups[0].name).toBe('New Name');
    expect(data.groups[0].color).toBe('#bbbbbb');
  });

  it('throws when the group does not exist', () => {
    const data: any = { groups: [], days: {} };
    expect(() => updateGroup(data, 'nonexistent', { name: 'X' })).toThrow();
  });
});

// ─── deleteGroup ─────────────────────────────────────────────────────────────
describe('deleteGroup', () => {
  it('removes the group from data.groups', () => {
    const data: any = { groups: [], days: {} };
    const g = addGroup(data, { name: 'ToDelete' });
    deleteGroup(data, g.id);
    expect(data.groups.find((x: any) => x.id === g.id)).toBeUndefined();
  });

  it('reports groupHasTasks = true when tasks reference the group', () => {
    const data: any = { groups: [], days: { '2026-03-12': { tasks: [] } } };
    const g = addGroup(data, { name: 'WithTask' });
    data.days['2026-03-12'].tasks.push({ id: 't1', groupId: g.id });
    const { groupHasTasks } = deleteGroup(data, g.id);
    expect(groupHasTasks).toBe(true);
  });

  it('reports groupHasTasks = false when no tasks reference the group', () => {
    const data: any = { groups: [], days: {} };
    const g = addGroup(data, { name: 'Empty' });
    const { groupHasTasks } = deleteGroup(data, g.id);
    expect(groupHasTasks).toBe(false);
  });

  it('removes groupId from tasks that referenced the deleted group', () => {
    const data: any = { groups: [], days: { '2026-03-12': { tasks: [] } } };
    const g = addGroup(data, { name: 'G' });
    const task = { id: 't1', groupId: g.id };
    data.days['2026-03-12'].tasks.push(task);
    deleteGroup(data, g.id);
    expect(task.groupId).toBeUndefined();
  });

  it("promotes child groups to the deleted group's parent (or root)", () => {
    const data: any = { groups: [], days: {} };
    const parent = addGroup(data, { name: 'Parent' });
    const mid = addGroup(data, { name: 'Mid', parentId: parent.id });
    const child = addGroup(data, { name: 'Child', parentId: mid.id });

    deleteGroup(data, mid.id);

    const childInData = data.groups.find((g: any) => g.id === child.id);
    expect(childInData).toBeTruthy();
    // child should now point to parent (mid's parent)
    expect(childInData.parentId).toBe(parent.id);
  });
});

// ─── getParentForActive ───────────────────────────────────────────────────────
describe('getParentForActive', () => {
  it('returns the parent group for a child active id', () => {
    const data: any = { groups: [], days: {} };
    const parent = addGroup(data, { name: 'Parent' });
    const child = addGroup(data, { name: 'Child', parentId: parent.id });

    const result = getParentForActive(data, child.id);
    expect(result).not.toBeNull();
    expect(result.id).toBe(parent.id);
  });

  it('returns null when the active group has no parent (root level)', () => {
    const data: any = { groups: [], days: {} };
    const root = addGroup(data, { name: 'Root' });
    expect(getParentForActive(data, root.id)).toBeNull();
  });

  it('returns null for a null active value', () => {
    const data: any = { groups: [], days: {} };
    expect(getParentForActive(data, null)).toBeNull();
  });

  it('accepts an active object with a value property', () => {
    const data: any = { groups: [], days: {} };
    const parent = addGroup(data, { name: 'P' });
    const child = addGroup(data, { name: 'C', parentId: parent.id });
    const result = getParentForActive(data, { label: child.name, value: child.id });
    expect(result!.id).toBe(parent.id);
  });
});

// ─── prepareGroupsForSave ─────────────────────────────────────────────────────
describe('prepareGroupsForSave', () => {
  it('attaches task arrays to each group', () => {
    const data: any = {
      groups: [],
      days: { '2026-03-12': { tasks: [] } },
    };
    const g = addGroup(data, { name: 'G' });
    data.days['2026-03-12'].tasks.push({ id: 't1', groupId: g.id });

    const saved = prepareGroupsForSave(data);
    const savedGroup = saved.groups.find((x: any) => x.id === g.id);
    expect(savedGroup).toBeTruthy();
    expect(savedGroup.tasks).toHaveLength(1);
    expect(savedGroup.tasks[0].id).toBe('t1');
  });

  it('leaves tasks array empty for groups without any tasks', () => {
    const data: any = { groups: [], days: {} };
    const g = addGroup(data, { name: 'Empty' });
    const saved = prepareGroupsForSave(data);
    expect(saved.groups.find((x: any) => x.id === g.id).tasks).toEqual([]);
  });

  it('does not mutate the original groups array', () => {
    const data: any = { groups: [], days: {} };
    addGroup(data, { name: 'G' });
    const originalRef = data.groups[0];
    prepareGroupsForSave(data);
    // original should not have grown a tasks field
    expect(originalRef.tasks).toBeUndefined();
  });
});

// ─── GroupActive.goToParent ───────────────────────────────────────────────────
import { ref } from 'vue';
import { GroupActive } from '../../src/modules/group/models/classes/GroupActive';

describe('GroupActive.goToParent', () => {
  it('navigates to the parent group when a child is active', () => {
    const parent = { id: 'p1', name: 'Parent', parentId: undefined };
    const child = { id: 'c1', name: 'Child', parentId: 'p1' };
    const groups = ref([parent, child]);
    const active = ref<{ label: string; value: string | null } | null>({
      label: 'Child',
      value: 'c1',
    });

    const ga = new GroupActive(groups, active);
    ga.goToParent();

    expect(active.value?.value).toBe('p1');
    expect(active.value?.label).toBe('Parent');
  });

  it('sets active to null when parent is a root group (no further parent)', () => {
    const root = { id: 'r1', name: 'Root', parentId: undefined };
    const groups = ref([root]);
    const active = ref<{ label: string; value: string | null } | null>({
      label: 'Root',
      value: 'r1',
    });

    const ga = new GroupActive(groups, active);
    ga.goToParent();

    expect(active.value).toBeNull();
  });

  it('selectAll resets active to null', () => {
    const groups = ref([{ id: 'g1', name: 'G' }]);
    const active = ref<{ label: string; value: string | null } | null>({ label: 'G', value: 'g1' });

    const ga = new GroupActive(groups, active);
    ga.selectAll();

    expect(active.value).toBeNull();
  });

  it('goToParent is safe to call without losing `this` (bound call)', () => {
    // Regression: unbound call via template @click="obj.goToParent" loses `this`
    // This test explicitly detaches the method and calls it bound — must not throw.
    const parent = { id: 'p1', name: 'Parent' };
    const child = { id: 'c1', name: 'Child', parentId: 'p1' };
    const groups = ref([parent, child]);
    const active = ref<{ label: string; value: string | null } | null>({
      label: 'Child',
      value: 'c1',
    });

    const ga = new GroupActive(groups, active);
    // Simulate what `() => CC.group.active.goToParent()` does — call through the object
    const boundCall = () => ga.goToParent();
    expect(() => boundCall()).not.toThrow();
    expect(active.value?.value).toBe('p1');
  });
});

// ─── GroupModel constructor & toJSON ─────────────────────────────────────────
describe('GroupModel', () => {
  it('does NOT use parent_id as the group own id (regression)', () => {
    const g = new GroupModel({ parent_id: 'parent-123' });
    // The group's own id must never be the parent's id.
    expect(g.id).not.toBe('parent-123');
    // A fresh UUID should have been generated instead.
    expect(g.id).toBeTruthy();
    expect(g.id.length).toBeGreaterThan(8);
  });

  it('uses data.id as own id even when parent_id is also present', () => {
    const g = new GroupModel({ id: 'my-own-id', parent_id: 'parent-id' });
    expect(g.id).toBe('my-own-id');
  });

  it('reads parentId from the camelCase field', () => {
    const g = new GroupModel({ id: 'g1', parentId: 'parent-abc' });
    expect(g.parentId).toBe('parent-abc');
  });

  it('reads parentId from the snake_case legacy field', () => {
    const g = new GroupModel({ id: 'g1', parent_id: 'parent-xyz' });
    expect(g.parentId).toBe('parent-xyz');
  });

  it('toJSON parent_id mirrors the canonical parentId', () => {
    const g = new GroupModel({ id: 'g1', name: 'G', parentId: 'p1' });
    expect(g.toJSON().parent_id).toBe('p1');
  });

  it('toJSON parent_id is null for a root group with no parentId', () => {
    const g = new GroupModel({ id: 'g1', name: 'Root' });
    expect(g.toJSON().parent_id).toBeNull();
  });
});

// ─── deleteGroup parent promotion (canonical parentId) ────────────────────────
describe('deleteGroup parent promotion', () => {
  it('promotes a child that only has parentId (camelCase) to grandparent', () => {
    const data: any = { groups: [], days: {} };
    const grandparent = addGroup(data, { name: 'GP' });
    const parent = addGroup(data, { name: 'Parent', parentId: grandparent.id });
    const child = addGroup(data, { name: 'Child', parentId: parent.id });

    deleteGroup(data, parent.id);

    const found = data.groups.find((g: any) => g.id === child.id);
    expect(found).toBeDefined();
    // Child should now point to grandparent
    expect(found.parentId).toBe(grandparent.id);
    expect(found.parent_id).toBe(grandparent.id);
  });

  it('sets parentId to undefined/null when deleted group was a root group', () => {
    const data: any = { groups: [], days: {} };
    const root = addGroup(data, { name: 'Root' });
    const child = addGroup(data, { name: 'Child', parentId: root.id });

    deleteGroup(data, root.id);

    const found = data.groups.find((g: any) => g.id === child.id);
    expect(found).toBeDefined();
    expect(found.parentId).toBeUndefined();
    expect(found.parent_id).toBeNull();
  });
});
