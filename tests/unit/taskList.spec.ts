/**
 * taskList.spec.ts
 *
 * Tests that guard against tasks going missing from the task list.
 * Covers three layers:
 *
 *  1. taskManager  — addTask / getAll / buildFlatTasksList
 *  2. computedTaskLists — sortedTasks, tasksWithoutTime, group-filter
 *  3. apiStorage   — loadData days-map precedence (the Todo-visibility bug)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { Task } from '../../src/modules/task/types';

// ─── Mock heavy external deps before importing modules that pull them in ────
vi.mock('src/modules/presentation/presentationManager', () => ({
  presentation: { mode: { value: 'default' } },
}));
vi.mock('src/modules/presentation/sampleData', () => ({ sampleData: {} }));
vi.mock('src/modules/storage', () => ({
  storage: {
    loadData: vi.fn(async () => ({ days: {}, groups: [], lastModified: '' })),
    saveData: vi.fn(async () => {}),
    exportToFile: vi.fn(),
    importFromFile: vi.fn(),
  },
  loadSettings: vi.fn(async () => ({})),
  saveSettings: vi.fn(async () => {}),
  getGroupFilesDirectory: vi.fn(async () => ''),
  getGroupFilename: vi.fn(() => ''),
  saveGroupsToFiles: vi.fn(async () => {}),
  deleteGroupFile: vi.fn(async () => {}),
}));

// Import after mocks are registered
import {
  addTask,
  setTimeApi,
  flatTasks,
  getTasksInRange,
  getAllTasks,
  listFromDays,
} from '../../src/modules/task/managers/taskManager';
import { createTaskComputed } from '../../src/modules/task/computedTaskLists';
import { construct as constructStorage } from '../../src/modules/storage/apiStorage';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0] as string;

function makeTask(overrides: Partial<Task> = {}): Task {
  return new Task({
    id: `t-${Math.random().toString(36).slice(2)}`,
    name: 'Test task',
    description: '',
    date: TODAY,
    category: 'other',
    priority: 'medium',
    status_id: 1,
    type_id: 'TimeEvent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });
}

function makeDaysRef(initialDays: Record<string, any> = {}) {
  const days = ref<Record<string, any>>(initialDays);
  return days;
}

/** Reset taskManager module-level state via setTimeApi with a fresh days ref */
function freshTimeApi(initialTasks: Task[] = [], date: string = TODAY) {
  const tasks = initialTasks.map((t) => ({ ...t }));
  const daysRef = makeDaysRef(tasks.length ? { [date]: { date, tasks, notes: '' } } : {});
  const timeApi = { days: daysRef, currentDate: ref(date), lastModified: ref('') };
  setTimeApi(timeApi);
  // Rebuild flatTasks from the initial days
  const list = listFromDays(daysRef.value);
  flatTasks.value.splice(0, flatTasks.value.length, ...list);
  return { daysRef, timeApi };
}

// ============================================================================
// 1. taskManager — addTask / getAll / buildFlatTasksList
// ============================================================================
describe('taskManager — task list completeness', () => {
  beforeEach(() => {
    freshTimeApi();
  });

  it('returns an added TimeEvent task via getAll', () => {
    addTask(TODAY, makeTask({ type_id: 'TimeEvent', name: 'Meeting' }) as any);
    const all = flatTasks.value;
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((t) => t.name === 'Meeting')).toBe(true);
  });

  it('returns a Todo task (no groupId) via getAll', () => {
    addTask(TODAY, makeTask({ type_id: 'Todo', groupId: undefined, name: 'My Todo' }) as any);
    expect(flatTasks.value.some((t) => t.type_id === 'Todo' && t.name === 'My Todo')).toBe(true);
  });

  it('returns a Replenish task via getAll', () => {
    addTask(TODAY, makeTask({ type_id: 'Replenish', name: 'Stock item' }) as any);
    expect(flatTasks.value.some((t) => t.type_id === 'Replenish')).toBe(true);
  });

  it('returns multiple tasks of different types — none are dropped', () => {
    addTask(TODAY, makeTask({ type_id: 'TimeEvent', name: 'Event' }) as any);
    addTask(TODAY, makeTask({ type_id: 'Todo', name: 'Todo A' }) as any);
    addTask(TODAY, makeTask({ type_id: 'Todo', name: 'Todo B' }) as any);
    const all = flatTasks.value;
    expect(all.length).toBe(3);
  });

  it('buildFlatTasksList rebuilds from a days map and keeps all tasks', () => {
    const t1 = makeTask({ type_id: 'TimeEvent', name: 'E1' });
    const t2 = makeTask({ type_id: 'Todo', name: 'T1' });
    const days = { [TODAY]: { date: TODAY, tasks: [t1, t2], notes: '' } };
    const result = listFromDays(days);
    expect(result.length).toBe(2);
    expect(result.some((t) => t.name === 'E1')).toBe(true);
    expect(result.some((t) => t.name === 'T1')).toBe(true);
  });

  it('getTasksInRange returns tasks stored across multiple dates', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;
    const t1 = makeTask({ date: yesterday, type_id: 'Todo', name: 'Old Todo' });
    const t2 = makeTask({ date: TODAY, type_id: 'TimeEvent', name: 'Event Today' });
    const daysRef = makeDaysRef({
      [yesterday]: { date: yesterday, tasks: [t1], notes: '' },
      [TODAY]: { date: TODAY, tasks: [t2], notes: '' },
    });
    setTimeApi({ days: daysRef, currentDate: ref(TODAY), lastModified: ref('') });
    const result = getTasksInRange('1970-01-01', '9999-12-31');
    expect(result.length).toBe(2);
    expect(result.some((t) => t.name === 'Old Todo')).toBe(true);
    expect(result.some((t) => t.name === 'Event Today')).toBe(true);
  });

  it('getAllTasks includes tasks regardless of groupId', () => {
    const withGroup = makeTask({ name: 'Grouped', groupId: 'g1' });
    const noGroup = makeTask({ type_id: 'Todo', name: 'No Group', groupId: undefined });
    const daysRef = makeDaysRef({
      [TODAY]: { date: TODAY, tasks: [withGroup, noGroup], notes: '' },
    });
    setTimeApi({ days: daysRef, currentDate: ref(TODAY), lastModified: ref('') });
    const all = getAllTasks();
    expect(all.some((t) => t.name === 'Grouped')).toBe(true);
    expect(all.some((t) => t.name === 'No Group')).toBe(true);
  });
});

// ============================================================================
// 2. computedTaskLists — sortedTasks / tasksWithoutTime visibility
// ============================================================================
describe('computedTaskLists — task list visibility', () => {
  it('sortedTasks includes tasks from currentDayData', () => {
    const tasks = [makeTask({ name: 'Task 1' }), makeTask({ name: 'Task 2' })];
    const { sortedTasks } = createTaskComputed({
      currentDayData: ref({ tasks }),
      currentDate: ref(TODAY),
      allTasks: ref([]),
    });
    expect(sortedTasks.value.length).toBe(2);
  });

  it('tasksWithoutTime includes a Todo with no eventTime', () => {
    const todo = makeTask({ type_id: 'Todo', eventTime: undefined, name: 'My Todo' });
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [todo] }),
      currentDate: ref(TODAY),
      allTasks: ref([todo]),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'My Todo')).toBe(true);
  });

  it('tasksWithTime includes a TimeEvent that has an eventTime', () => {
    const event = makeTask({ type_id: 'TimeEvent', eventTime: '09:00', name: 'Morning' });
    const { tasksWithTime } = createTaskComputed({
      currentDayData: ref({ tasks: [event] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
    });
    expect(tasksWithTime.value.some((t) => t.name === 'Morning')).toBe(true);
  });

  it('done tasks (status_id=0) are excluded from tasksWithoutTime', () => {
    const done = makeTask({ type_id: 'Todo', status_id: 0, name: 'Done Todo' });
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [done] }),
      currentDate: ref(TODAY),
      allTasks: ref([done]),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Done Todo')).toBe(false);
  });

  it('done tasks (status_id=0) appear in doneTasks', () => {
    const done = makeTask({ type_id: 'Todo', status_id: 0, name: 'Done Todo' });
    const { doneTasks } = createTaskComputed({
      currentDayData: ref({ tasks: [done] }),
      currentDate: ref(TODAY),
      allTasks: ref([done]),
    });
    expect(doneTasks.value.some((t) => t.name === 'Done Todo')).toBe(true);
  });

  it('Replenish tasks are excluded from tasksWithoutTime', () => {
    const rep = makeTask({ type_id: 'Replenish', name: 'Buy milk' });
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [rep] }),
      currentDate: ref(TODAY),
      allTasks: ref([rep]),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Buy milk')).toBe(false);
  });

  it('Replenish tasks appear in replenishTasks', () => {
    const rep = makeTask({ type_id: 'Replenish', name: 'Buy milk', status_id: 1 });
    const { replenishTasks } = createTaskComputed({
      currentDayData: ref({ tasks: [rep] }),
      currentDate: ref(TODAY),
      allTasks: ref([rep]),
    });
    expect(replenishTasks.value.some((t) => t.name === 'Buy milk')).toBe(true);
  });

  it('group filter: all tasks visible when no active group', () => {
    const t1 = makeTask({ name: 'A', groupId: 'g1' });
    const t2 = makeTask({ name: 'B', groupId: 'g2' });
    const t3 = makeTask({ name: 'C', groupId: undefined });
    const apiGroup = {
      list: {
        all: ref([
          { id: 'g1', name: 'Group 1' },
          { id: 'g2', name: 'Group 2' },
        ]),
        isVisibleForActive: (_id: any) => true, // no filter when no active group
        getGroupsByParent: () => [],
      },
      active: { activeGroup: ref(null) },
    };
    const { sortedTasks } = createTaskComputed({
      currentDayData: ref({ tasks: [t1, t2, t3] }),
      currentDate: ref(TODAY),
      allTasks: ref([t1, t2, t3]),
      apiGroup,
    });
    expect(sortedTasks.value.length).toBe(3);
  });

  it('group filter: tasks from another group are hidden when active group is set', () => {
    const visible = makeTask({ name: 'Visible', groupId: 'g1' });
    const hidden = makeTask({ name: 'Hidden', groupId: 'g2' });
    const apiGroup = {
      list: {
        all: ref([
          { id: 'g1', name: 'Active' },
          { id: 'g2', name: 'Other' },
        ]),
        // Only g1 tasks are visible
        isVisibleForActive: (id: any) => String(id) === 'g1',
        getGroupsByParent: () => [],
      },
      active: { activeGroup: ref({ label: 'Active', value: 'g1' }) },
    };
    const { sortedTasks } = createTaskComputed({
      currentDayData: ref({ tasks: [visible, hidden] }),
      currentDate: ref(TODAY),
      allTasks: ref([visible, hidden]),
      apiGroup,
    });
    expect(sortedTasks.value.some((t) => t.name === 'Visible')).toBe(true);
    expect(sortedTasks.value.some((t) => t.name === 'Hidden')).toBe(false);
  });

  it('Todos from getTasksInRange are injected into sortedTasks even when NOT in currentDayData (today)', () => {
    // The old bug: Todo task stored under a different date was invisible
    // because it never appeared in currentDayData.tasks for today.
    const oldTodo = makeTask({
      type_id: 'Todo',
      name: 'Old Todo injected today',
      date: '2025-01-01', // stored on a past date
      status_id: 1,
    });
    const apiTask = {
      list: { inRange: (_from: string, _to: string) => [oldTodo] },
      helpers: {},
    };
    const { sortedTasks } = createTaskComputed({
      currentDayData: ref({ tasks: [] }), // NOT in current day
      currentDate: ref(TODAY),
      allTasks: ref([oldTodo]),
      apiTask,
    });
    expect(sortedTasks.value.some((t) => t.name === 'Old Todo injected today')).toBe(true);
  });

  it('Todos from getTasksInRange are injected into sortedTasks when viewing a NON-today date', () => {
    // Regression test: before the fix, injection was gated behind currentDate === todayStr,
    // so Todos were invisible when navigating away from today.
    const PAST_DATE = '2026-01-15';
    const todo = makeTask({
      type_id: 'Todo',
      name: 'Todo on past date view',
      date: '2025-06-01',
      status_id: 1,
    });
    const apiTask = {
      list: { inRange: (_from: string, _to: string) => [todo] },
      helpers: {},
    };
    const { sortedTasks } = createTaskComputed({
      currentDayData: ref({ tasks: [] }), // empty — Todo must come via injection
      currentDate: ref(PAST_DATE), // viewing a non-today date
      allTasks: ref([todo]),
      apiTask,
    });
    expect(sortedTasks.value.some((t) => t.name === 'Todo on past date view')).toBe(true);
  });

  it('non-Todo tasks from getTasksInRange are NOT injected into non-today views', () => {
    // Only Todos should be injected across dates; TimeEvents should not bleed into other days
    const PAST_DATE = '2026-01-15';
    const otherDayEvent = makeTask({
      type_id: 'TimeEvent',
      name: 'Event on another day',
      date: '2025-06-01',
      status_id: 1,
    });
    const apiTask = {
      list: { inRange: (_from: string, _to: string) => [otherDayEvent] },
      helpers: {},
    };
    const { sortedTasks } = createTaskComputed({
      currentDayData: ref({ tasks: [] }),
      currentDate: ref(PAST_DATE),
      allTasks: ref([otherDayEvent]),
      apiTask,
    });
    expect(sortedTasks.value.some((t) => t.name === 'Event on another day')).toBe(false);
  });

  it('completed Todos (status_id=0) injected via getTasksInRange do NOT appear in tasksWithoutTime', () => {
    const doneTodo = makeTask({
      type_id: 'Todo',
      name: 'Done injected Todo',
      date: '2025-01-01',
      status_id: 0,
    });
    const apiTask = {
      list: { inRange: (_from: string, _to: string) => [doneTodo] },
      helpers: {},
    };
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [] }),
      currentDate: ref(TODAY),
      allTasks: ref([doneTodo]),
      apiTask,
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Done injected Todo')).toBe(false);
  });
});

// ============================================================================
// 3. apiStorage.loadData — data.days takes precedence over daysFromGroups
// ============================================================================
describe('apiStorage.loadData — task preservation', () => {
  it('loads tasks from data.days when present, including Todos without groupId', async () => {
    const todoTask = makeTask({ type_id: 'Todo', name: 'Ungrouped Todo', groupId: undefined });
    const eventTask = makeTask({ type_id: 'TimeEvent', name: 'Event', groupId: 'g1' });

    // days map has both tasks; groups only embed the EventTask
    const fakeData = {
      days: {
        [TODAY]: { date: TODAY, tasks: [todoTask, eventTask], notes: '' },
      },
      groups: [{ id: 'g1', name: 'Group 1', tasks: [eventTask] }],
      lastModified: new Date().toISOString(),
    };

    const { storage: backendMock } = await import('../../src/modules/storage');
    (backendMock.loadData as any).mockResolvedValueOnce(fakeData);

    // Construct a fresh storage instance with stub APIs
    const daysRef = ref<Record<string, any>>({});
    const groupList = ref<any[]>([]);
    const groupApi = {
      list: {
        all: groupList,
        setGroups: (g: any[]) => {
          groupList.value = g;
        },
      },
      active: { activeGroup: ref(null) },
    };
    const timeApi = { days: daysRef, lastModified: ref('') };

    const storageApi = constructStorage(groupApi, timeApi);
    await storageApi.loadData();

    const loadedTasks = Object.values(daysRef.value).flatMap((d: any) => d.tasks || []);
    expect(loadedTasks.length).toBe(2);
    expect(loadedTasks.some((t: any) => t.name === 'Ungrouped Todo')).toBe(true);
    expect(loadedTasks.some((t: any) => t.name === 'Event')).toBe(true);
  });

  it('falls back to daysFromGroups when data.days is absent', async () => {
    const eventTask = makeTask({ type_id: 'TimeEvent', name: 'Event', groupId: 'g1' });

    const fakeData = {
      // No `days` key — legacy format
      groups: [{ id: 'g1', name: 'Group 1', tasks: [{ ...eventTask, date: TODAY }] }],
      lastModified: new Date().toISOString(),
    };

    const { storage: backendMock } = await import('../../src/modules/storage');
    (backendMock.loadData as any).mockResolvedValueOnce(fakeData);

    const daysRef = ref<Record<string, any>>({});
    const groupList = ref<any[]>([]);
    const groupApi = {
      list: {
        all: groupList,
        setGroups: (g: any[]) => {
          groupList.value = g;
        },
      },
      active: { activeGroup: ref(null) },
    };
    const timeApi = { days: daysRef, lastModified: ref('') };

    const storageApi = constructStorage(groupApi, timeApi);
    await storageApi.loadData();

    const loadedTasks = Object.values(daysRef.value).flatMap((d: any) => d.tasks || []);
    expect(loadedTasks.length).toBe(1);
    expect(loadedTasks.some((t: any) => t.name === 'Event')).toBe(true);
  });

  it('data.days with zero entries falls back to daysFromGroups', async () => {
    const eventTask = makeTask({ type_id: 'TimeEvent', name: 'Event', groupId: 'g1' });

    const fakeData = {
      days: {}, // present but empty
      groups: [{ id: 'g1', name: 'Group 1', tasks: [{ ...eventTask, date: TODAY }] }],
      lastModified: new Date().toISOString(),
    };

    const { storage: backendMock } = await import('../../src/modules/storage');
    (backendMock.loadData as any).mockResolvedValueOnce(fakeData);

    const daysRef = ref<Record<string, any>>({});
    const groupList = ref<any[]>([]);
    const groupApi = {
      list: {
        all: groupList,
        setGroups: (g: any[]) => {
          groupList.value = g;
        },
      },
      active: { activeGroup: ref(null) },
    };
    const timeApi = { days: daysRef, lastModified: ref('') };

    const storageApi = constructStorage(groupApi, timeApi);
    await storageApi.loadData();

    const loadedTasks = Object.values(daysRef.value).flatMap((d: any) => d.tasks || []);
    expect(loadedTasks.length).toBe(1);
  });
});
