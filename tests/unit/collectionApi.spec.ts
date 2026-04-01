/**
 * collectionApi.spec.ts
 *
 * Unit tests for the collection-helper methods added to TaskList and GroupList.
 * These are thin wrappers around native array operations so tests are kept compact.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { TaskRepository } from '../../src/modules/task/managers/taskRepository';
import { TaskList } from '../../src/modules/task/models/classes/TaskList';
import { GroupList } from '../../src/modules/group/models/classes/GroupList';
import { GroupModel } from '../../src/modules/group/models/GroupModel';
import type { Task } from '../../src/modules/task/models/TaskModel';
import type { Group } from '../../src/modules/group/models/GroupModel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0] as string;

function makeTask(overrides: Partial<Task> = {}): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Test',
    description: '',
    date: TODAY,
    category: 'other',
    priority: 'medium',
    status_id: 1,
    type_id: 'Todo',
    ...overrides,
  } as any;
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return new GroupModel({
    id: `g-${Math.random().toString(36).slice(2)}`,
    name: 'Group',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }) as unknown as Group;
}

// ─── TaskList collection API ───────────────────────────────────────────────────

describe('TaskList — collection helpers', () => {
  let repo: TaskRepository;
  let list: TaskList;

  beforeEach(() => {
    repo = new TaskRepository();
    list = new TaskList(repo);
    // Seed: 3 tasks – two in group-A, one in group-B
    repo.addTask(TODAY, makeTask({ name: 'A1', groupId: 'group-A', priority: 'high' }));
    repo.addTask(
      TODAY,
      makeTask({ name: 'A2', groupId: 'group-A', priority: 'low', status_id: 0 }),
    );
    repo.addTask(TODAY, makeTask({ name: 'B1', groupId: 'group-B', priority: 'medium' }));
  });

  it('byGroup returns only tasks matching the given groupId', () => {
    const result = list.byGroup('group-A');
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.groupId === 'group-A')).toBe(true);
  });

  it('byGroup returns empty array for unknown group', () => {
    expect(list.byGroup('nope')).toHaveLength(0);
  });

  it('where filters by a single property', () => {
    const highs = list.where('priority', 'high');
    expect(highs).toHaveLength(1);
    expect(highs[0]!.name).toBe('A1');
  });

  it('first returns the first task when no predicate is given', () => {
    const f = list.first();
    expect(f).toBeDefined();
    expect(f!.name).toBe('A1');
  });

  it('first with predicate returns the first matching task', () => {
    const f = list.first((t) => t.groupId === 'group-B');
    expect(f!.name).toBe('B1');
  });

  it('first returns undefined on empty list', () => {
    const emptyRepo = new TaskRepository();
    expect(new TaskList(emptyRepo).first()).toBeUndefined();
  });

  it('last returns the last task when no predicate is given', () => {
    const l = list.last();
    expect(l!.name).toBe('B1');
  });

  it('last with predicate returns the last matching task', () => {
    const l = list.last((t) => t.groupId === 'group-A');
    expect(l!.name).toBe('A2');
  });

  it('count with no predicate returns total task count', () => {
    expect(list.count()).toBe(3);
  });

  it('count with predicate returns matching count', () => {
    expect(list.count((t) => t.groupId === 'group-A')).toBe(2);
  });

  it('groupBy buckets tasks by the given key', () => {
    const buckets = list.groupBy('groupId');
    expect(buckets.size).toBe(2);
    expect(buckets.get('group-A')).toHaveLength(2);
    expect(buckets.get('group-B')).toHaveLength(1);
  });

  it('pluck extracts a single property from every task', () => {
    const names = list.pluck('name');
    expect(names).toEqual(['A1', 'A2', 'B1']);
  });
});

// ─── GroupList collection API ─────────────────────────────────────────────────

describe('GroupList — collection helpers', () => {
  let groupsRef: ReturnType<typeof ref<Group[]>>;
  let activeRef: ReturnType<typeof ref<{ label: string; value: string | null } | null>>;
  let list: GroupList;

  let gA: Group;
  let gB: Group;
  let gChild: Group;

  beforeEach(() => {
    gA = makeGroup({ id: 'g-a', name: 'Alpha' });
    gB = makeGroup({ id: 'g-b', name: 'Beta' });
    gChild = makeGroup({ id: 'g-child', name: 'Child', parentId: 'g-a' });

    groupsRef = ref<Group[]>([gA, gB, gChild]);
    activeRef = ref<{ label: string; value: string | null } | null>(null);
    list = new GroupList(groupsRef as any, activeRef as any);
  });

  it('find returns the group matching the given id', () => {
    const found = list.find('g-b');
    expect(found?.name).toBe('Beta');
  });

  it('find returns undefined for an unknown id', () => {
    expect(list.find('nope')).toBeUndefined();
  });

  it('where filters by a property value', () => {
    const roots = list.where('parentId', undefined);
    expect(roots.every((g) => !g.parentId)).toBe(true);
    expect(roots.length).toBe(2); // gA and gB have no parentId
  });

  it('first with no predicate returns the first group', () => {
    expect(list.first()?.id).toBe('g-a');
  });

  it('first with predicate returns the first match', () => {
    expect(list.first((g) => g.name === 'Beta')?.id).toBe('g-b');
  });

  it('first returns undefined on an empty list', () => {
    groupsRef.value = [];
    expect(list.first()).toBeUndefined();
  });

  it('isEmpty returns true when there are no groups', () => {
    groupsRef.value = [];
    expect(list.isEmpty()).toBe(true);
  });

  it('isEmpty returns false when groups exist', () => {
    expect(list.isEmpty()).toBe(false);
  });

  it('count returns the total number of groups', () => {
    expect(list.count()).toBe(3);
  });

  it('byParent returns direct children of the given parent', () => {
    const children = list.byParent('g-a');
    expect(children).toHaveLength(1);
    expect(children[0]!.id).toBe('g-child');
  });

  it('byParent with no argument returns root groups', () => {
    const roots = list.byParent();
    expect(roots.every((g) => !g.parentId)).toBe(true);
  });
});
