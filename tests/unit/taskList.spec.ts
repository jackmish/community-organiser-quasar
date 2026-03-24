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
import { Task } from '../../src/modules/task/models/TaskModel';

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
import { createTaskComputed } from '../../src/modules/task/computed/computedTaskLists';
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
    ``;
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

// ============================================================================
// 4. TimeEvent visibility — end-to-end scenarios
// ============================================================================
describe('TimeEvent visibility — computedTaskLists scenarios', () => {
  const GROUP_ID = 'grp-1';
  const makeGroupApi = (activeGroupId: string | null = null) => ({
    list: {
      all: ref([{ id: GROUP_ID, name: 'Test Group' }]),
      isVisibleForActive: (id: any) => {
        if (!activeGroupId) return true; // all groups: show everything
        return String(id) === activeGroupId;
      },
      getGroupsByParent: () => [],
    },
    active: {
      activeGroup: ref(activeGroupId ? { label: 'Test Group', value: activeGroupId } : null),
    },
  });

  it('TimeEvent in currentDayData appears in tasksWithTime when it has eventTime', () => {
    const event = makeTask({
      type_id: 'TimeEvent',
      eventTime: '10:00',
      name: 'Morning meeting',
      groupId: GROUP_ID,
    });
    const { tasksWithTime } = createTaskComputed({
      currentDayData: ref({ tasks: [event] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithTime.value.some((t) => t.name === 'Morning meeting')).toBe(true);
  });

  it('TimeEvent in currentDayData appears in tasksWithoutTime when no eventTime', () => {
    const event = makeTask({
      type_id: 'TimeEvent',
      eventTime: '',
      name: 'All-day event',
      groupId: GROUP_ID,
    });
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [event] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'All-day event')).toBe(true);
  });

  it('TimeEvent with matching groupId appears when active group is set', () => {
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Group event',
      groupId: GROUP_ID,
    });
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [event] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Group event')).toBe(true);
  });

  it('TimeEvent with wrong groupId is hidden when different active group is set', () => {
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Other group event',
      groupId: 'other-group',
    });
    const { tasksWithoutTime, tasksWithTime } = createTaskComputed({
      currentDayData: ref({ tasks: [event] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Other group event')).toBe(false);
    expect(tasksWithTime.value.some((t) => t.name === 'Other group event')).toBe(false);
  });

  it('TimeEvent from allTasks (not in currentDayData) for the currentDate is injected via cyclic loop', () => {
    // A TimeEvent that is in allTasks but NOT in currentDayData should still appear
    // via the occursOnDay injection loop (non-cyclic tasks match by date)
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Injected event',
      date: TODAY,
      eventDate: TODAY,
      groupId: GROUP_ID,
    });
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [] }), // NOT in current day data
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Injected event')).toBe(true);
  });

  it('TimeEvent from allTasks for a DIFFERENT date does NOT appear on currentDate', () => {
    const FUTURE_DATE = '2099-01-15';
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Future event',
      date: FUTURE_DATE,
      eventDate: FUTURE_DATE,
      groupId: GROUP_ID,
    });
    const { tasksWithoutTime, tasksWithTime } = createTaskComputed({
      currentDayData: ref({ tasks: [] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Future event')).toBe(false);
    expect(tasksWithTime.value.some((t) => t.name === 'Future event')).toBe(false);
  });

  it('TimeEvent with eventTime appears on its own date when added via addTask flow', () => {
    // Simulate the full addTask → currentDayData → tasksWithTime flow
    const { daysRef, timeApi } = freshTimeApi([], TODAY);
    // Simulate adding a task to the days map (as addTask would do)
    if (!daysRef.value[TODAY]) daysRef.value[TODAY] = { date: TODAY, tasks: [], notes: '' };
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Timed event',
      date: TODAY,
      eventDate: TODAY,
      eventTime: '14:30',
      groupId: GROUP_ID,
    });
    daysRef.value[TODAY].tasks.push(event);
    flatTasks.value.splice(0, flatTasks.value.length, ...listFromDays(daysRef.value));

    const currentDayData = ref({ tasks: daysRef.value[TODAY]?.tasks || [] });
    const allTasksRef = ref(flatTasks.value.slice());

    const { tasksWithTime } = createTaskComputed({
      currentDayData,
      currentDate: ref(TODAY),
      allTasks: allTasksRef,
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithTime.value.some((t) => t.name === 'Timed event')).toBe(true);
  });

  it('TimeEvent with null groupId is hidden when active group is set', () => {
    // This documents the expected behavior: ungrouped tasks are hidden when filtering by group
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Ungrouped event',
      groupId: undefined,
    });
    const { tasksWithoutTime, tasksWithTime } = createTaskComputed({
      currentDayData: ref({ tasks: [event] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Ungrouped event')).toBe(false);
    expect(tasksWithTime.value.some((t) => t.name === 'Ungrouped event')).toBe(false);
  });

  it('TimeEvent with null groupId is VISIBLE when All Groups (no active group)', () => {
    // Ungrouped events should show in "All Groups" mode
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Ungrouped visible event',
      groupId: undefined,
    });
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [event] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: makeGroupApi(null), // null = "All Groups"
    });
    expect(tasksWithoutTime.value.some((t) => t.name === 'Ungrouped visible event')).toBe(true);
  });

  it('done TimeEvent (status_id=0) does NOT appear in tasksWithTime or tasksWithoutTime', () => {
    const doneEvent = makeTask({
      type_id: 'TimeEvent',
      name: 'Done event',
      status_id: 0,
      eventTime: '09:00',
      groupId: GROUP_ID,
    });
    const { tasksWithTime, tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [doneEvent] }),
      currentDate: ref(TODAY),
      allTasks: ref([doneEvent]),
      apiGroup: makeGroupApi(GROUP_ID),
    });
    expect(tasksWithTime.value.some((t) => t.name === 'Done event')).toBe(false);
    expect(tasksWithoutTime.value.some((t) => t.name === 'Done event')).toBe(false);
  });
});

// ============================================================================
// 5. TimeEvent reactivity — addTask mutates days, computed updates correctly
// ============================================================================
describe('TimeEvent reactivity — addTask + computed updates', () => {
  const GROUP_ID = 'grp-1';
  const makeGroupApi = (activeGroupId: string | null = null) => ({
    list: {
      all: ref([{ id: GROUP_ID, name: 'Test Group' }]),
      isVisibleForActive: (id: any) => {
        if (!activeGroupId) return true;
        return String(id) === activeGroupId;
      },
      getGroupsByParent: () => [],
    },
    active: {
      activeGroup: ref(activeGroupId ? { label: 'Test Group', value: activeGroupId } : null),
    },
  });

  beforeEach(() => {
    freshTimeApi();
  });

  it('tasksWithoutTime updates reactively after addTask on empty days', () => {
    // Start with no tasks – currentDayData starts as empty
    const { daysRef } = freshTimeApi([], TODAY);
    const currentDate = ref(TODAY);

    // currentDayData is a real computed that reads from the same daysRef
    const { computed } = require('vue');
    const currentDayData = computed(() => {
      const d = daysRef.value[currentDate.value];
      return d || { date: currentDate.value, tasks: [], notes: '' };
    });

    const allTasksRef = computed(() => listFromDays(daysRef.value));

    const { tasksWithoutTime } = createTaskComputed({
      currentDayData,
      currentDate,
      allTasks: allTasksRef,
      apiGroup: makeGroupApi(GROUP_ID),
    });

    // Before adding: no tasks
    expect(tasksWithoutTime.value.length).toBe(0);

    // Simulate addTask: add new day entry and push task (same as taskManager.addTask)
    daysRef.value[TODAY] = { date: TODAY, tasks: [], notes: '' };
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Reactive event',
      date: TODAY,
      eventDate: TODAY,
      groupId: GROUP_ID,
      eventTime: '',
    });
    daysRef.value[TODAY].tasks.push(event);

    // After adding: task should appear
    expect(tasksWithoutTime.value.some((t) => t.name === 'Reactive event')).toBe(true);
  });

  it('tasksWithTime updates reactively after adding a timed event via daysRef mutation', () => {
    const { daysRef } = freshTimeApi([], TODAY);
    const currentDate = ref(TODAY);
    const { computed } = require('vue');
    const currentDayData = computed(() => {
      const d = daysRef.value[currentDate.value];
      return d || { date: currentDate.value, tasks: [], notes: '' };
    });
    const allTasksRef = computed(() => listFromDays(daysRef.value));

    const { tasksWithTime } = createTaskComputed({
      currentDayData,
      currentDate,
      allTasks: allTasksRef,
      apiGroup: makeGroupApi(GROUP_ID),
    });

    expect(tasksWithTime.value.length).toBe(0);

    daysRef.value[TODAY] = { date: TODAY, tasks: [], notes: '' };
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Timed reactive event',
      date: TODAY,
      eventDate: TODAY,
      eventTime: '09:30',
      groupId: GROUP_ID,
    });
    daysRef.value[TODAY].tasks.push(event);

    expect(tasksWithTime.value.some((t) => t.name === 'Timed reactive event')).toBe(true);
  });

  it('currentDate change shows tasks for the new date instantly', () => {
    const DATE2 = '2099-12-25';
    const { daysRef } = freshTimeApi([], TODAY);
    const currentDate = ref(TODAY);
    const { computed } = require('vue');
    const currentDayData = computed(() => {
      const d = daysRef.value[currentDate.value];
      return d || { date: currentDate.value, tasks: [], notes: '' };
    });
    const allTasksRef = computed(() => listFromDays(daysRef.value));

    const { tasksWithoutTime } = createTaskComputed({
      currentDayData,
      currentDate,
      allTasks: allTasksRef,
      apiGroup: makeGroupApi(GROUP_ID),
    });

    // Add a task for DATE2
    daysRef.value[DATE2] = { date: DATE2, tasks: [], notes: '' };
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Christmas event',
      date: DATE2,
      eventDate: DATE2,
      groupId: GROUP_ID,
    });
    daysRef.value[DATE2].tasks.push(event);

    // On TODAY: should not see Christmas event
    expect(tasksWithoutTime.value.some((t) => t.name === 'Christmas event')).toBe(false);

    // Navigate to DATE2
    currentDate.value = DATE2;

    // Now should see the Christmas event
    expect(tasksWithoutTime.value.some((t) => t.name === 'Christmas event')).toBe(true);
  });

  it('task with wrong groupId does not appear when specific group is active', () => {
    const { daysRef } = freshTimeApi([], TODAY);
    const currentDate = ref(TODAY);
    const { computed } = require('vue');
    const currentDayData = computed(() => {
      const d = daysRef.value[currentDate.value];
      return d || { date: currentDate.value, tasks: [], notes: '' };
    });
    const allTasksRef = computed(() => listFromDays(daysRef.value));

    const { tasksWithoutTime } = createTaskComputed({
      currentDayData,
      currentDate,
      allTasks: allTasksRef,
      apiGroup: makeGroupApi(GROUP_ID), // active group = GROUP_ID
    });

    daysRef.value[TODAY] = { date: TODAY, tasks: [], notes: '' };
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Wrong group event',
      date: TODAY,
      eventDate: TODAY,
      groupId: 'other-grp',
    });
    daysRef.value[TODAY].tasks.push(event);

    // Should NOT be visible because groupId doesn't match active group
    expect(tasksWithoutTime.value.some((t) => t.name === 'Wrong group event')).toBe(false);
  });
});

// ============================================================================
// 6. Regression: getCycleType + buildFlatTasksList fixes
// ============================================================================
import { getCycleType } from '../../src/modules/task/utils/occursOnDay';

describe('getCycleType regression — repeat:{} treated as non-cyclic', () => {
  it('returns null for repeat: null', () => {
    expect(getCycleType({ repeat: null })).toBeNull();
  });

  it('returns null for task with no repeat property', () => {
    expect(getCycleType({ name: 'No repeat' })).toBeNull();
  });

  it('returns null for repeat: {} (empty object — the bug fix)', () => {
    // Previously returned 'dayWeek', causing tasks to be permanently filtered out
    expect(getCycleType({ repeat: {} })).toBeNull();
  });

  it('returns the cycleType string when repeat.cycleType is set', () => {
    expect(getCycleType({ repeat: { cycleType: 'dayWeek' } })).toBe('dayWeek');
    expect(getCycleType({ repeat: { cycleType: 'other' } })).toBe('other');
  });

  it('falls back to cycle_type (snake_case) when cycleType is absent', () => {
    expect(getCycleType({ repeat: { cycle_type: 'dayWeek' } })).toBe('dayWeek');
  });

  it('task with repeat:{} is VISIBLE in tasksWithoutTime (the actual bug scenario)', () => {
    // This was the core bug: repeat:{} caused getCycleType to return 'dayWeek',
    // making isCyclicNotOccurring return true → task removed from all lists.
    const GROUP_ID = 'grp-x';
    const event = makeTask({
      type_id: 'TimeEvent',
      name: 'Empty repeat event',
      date: TODAY,
      eventDate: TODAY,
      groupId: GROUP_ID,
      repeat: {} as any, // ← the problematic data shape
    });
    const { tasksWithoutTime } = createTaskComputed({
      currentDayData: ref({ tasks: [event] }),
      currentDate: ref(TODAY),
      allTasks: ref([event]),
      apiGroup: {
        list: {
          all: ref([{ id: GROUP_ID, name: 'Test' }]),
          isVisibleForActive: () => true,
          getGroupsByParent: () => [],
        },
        active: { activeGroup: ref({ label: 'Test', value: GROUP_ID }) },
      },
    });
    // With the fix, task with repeat:{} is treated as non-cyclic → should be visible
    expect(tasksWithoutTime.value.some((t) => t.name === 'Empty repeat event')).toBe(true);
  });
});

describe('buildFlatTasksList regression — flatTasks populated after loadData', () => {
  it('flatTasks is populated after buildFlatTasksList result is applied', () => {
    const t1 = makeTask({ name: 'Loaded event', type_id: 'TimeEvent' });
    const t2 = makeTask({ name: 'Loaded todo', type_id: 'Todo' });
    const days = { [TODAY]: { date: TODAY, tasks: [t1, t2], notes: '' } };

    // Simulate what apiStorage.loadData now does: apply the return value
    const loaded = listFromDays(days);
    flatTasks.value.splice(0, flatTasks.value.length, ...loaded);

    expect(flatTasks.value.length).toBe(2);
    expect(flatTasks.value.some((t) => t.name === 'Loaded event')).toBe(true);
    expect(flatTasks.value.some((t) => t.name === 'Loaded todo')).toBe(true);
  });

  it('flatTasks is empty after loading empty days', () => {
    const loaded = listFromDays({});
    flatTasks.value.splice(0, flatTasks.value.length, ...loaded);
    expect(flatTasks.value.length).toBe(0);
  });
});
