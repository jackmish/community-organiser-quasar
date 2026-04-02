/**
 * taskCrudHandlers.spec.ts
 *
 * Guards against the "unbound-this" regression:
 *   TypeError: Cannot read properties of undefined (reading 'mgr')
 *   at setTask (TaskActive.ts:21)
 *   at handleUpdateTask (taskCrudHandlers.ts:79)
 *
 * Root cause: destructuring `setTask` from a class instance loses `this`.
 * Fix: wrap in arrow — `(t) => active.setTask!(t)`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// ── Mock CentralController so `api.task.update/add` don't hit real storage ───
vi.mock('src/CentralController', () => {
  const mock = {
    task: {
      add: vi.fn(async (_date: string, payload: any) => ({ ...payload, id: 'new-id' })),
      update: vi.fn(async () => {}),
    },
    group: { active: { value: null } },
  } as any;
  return { default: mock, ...mock };
});

import { useTaskCrud } from '../../src/composables/useTaskCrud';

// ── A minimal class that mimics TaskActive ────────────────────────────────────
class FakeActive {
  /** Simulates `this.mgr` — must be defined for `setTask` to work. */
  private readonly internal = { marker: 'real-this' };

  readonly task = ref<any>(null);
  readonly mode = ref<'add' | 'edit' | 'preview'>('add');

  /** If `this` is lost, accessing `this.internal` throws. */
  setTask(t: any) {
    // accessing `this.internal` will throw if `this` is lost (undefined)
    void this.internal.marker;
    this.task.value = t;
    this.mode.value = t ? 'preview' : 'add';
  }

  setMode(m: 'add' | 'edit' | 'preview') {
    this.mode.value = m;
  }
}

function makeHandlers(active: FakeActive) {
  const task = { id: '1', name: 'Existing', date: '2026-03-12' };
  const allTasks = ref([task]);
  return {
    handlers: useTaskCrud({
      setCurrentDate: vi.fn(),
      activeGroup: ref({ value: 'g1' }),
      currentDate: ref('2026-03-12'),
      allTasks,
      quasar: { notify: vi.fn() },
      active,
    }),
    allTasks,
    task,
  };
}

describe('useTaskCrud — class-based active (unbound-this regression)', () => {
  let active: FakeActive;

  beforeEach(() => {
    active = new FakeActive();
  });

  it('handleUpdateTask: does NOT throw when active is a class instance', async () => {
    const { handlers, task } = makeHandlers(active);
    await expect(handlers.handleUpdateTask(task)).resolves.not.toThrow();
  });

  it('handleUpdateTask: setTask called with the updated task object (this preserved)', async () => {
    const { handlers, task } = makeHandlers(active);
    await handlers.handleUpdateTask(task);
    // If `this` was lost, task.value would still be null and mode 'add'
    expect(active.task.value).toMatchObject({ id: '1' });
    expect(active.mode.value).toBe('preview');
  });

  it('handleUpdateTask: sets mode to "add" when task is not found in allTasks', async () => {
    const { handlers } = makeHandlers(active);
    // id not in allTasks
    await handlers.handleUpdateTask({ id: 'not-found', name: 'Ghost', date: '2026-03-12' });
    expect(active.task.value).toBeNull();
    expect(active.mode.value).toBe('add');
  });

  it('handleUpdateTask: silently skips when updatedTask has no id', async () => {
    const { handlers } = makeHandlers(active);
    await expect(handlers.handleUpdateTask({ name: 'No ID' })).resolves.not.toThrow();
    expect(active.task.value).toBeNull();
  });

  it('handleUpdateTask: calls api.task.update with the task date and full payload', async () => {
    const { handlers, task } = makeHandlers(active);
    const { task: apiMock } = await import('src/CentralController');
    await handlers.handleUpdateTask(task);
    expect(apiMock.update).toHaveBeenCalledWith('2026-03-12', expect.objectContaining({ id: '1' }));
  });

  it('handleUpdateTask: uses eventDate when date field is absent', async () => {
    const active2 = new FakeActive();
    const taskNoDate = { id: '2', name: 'No date field', eventDate: '2026-05-01' };
    const allTasks = ref([taskNoDate]);
    const { handlers } = {
      handlers: useTaskCrud({
        setCurrentDate: vi.fn(),
        activeGroup: ref({ value: 'g1' }),
        currentDate: ref('2026-03-12'),
        allTasks,
        quasar: { notify: vi.fn() },
        active: active2,
      }),
    };
    const { task: apiMock } = await import('src/CentralController');
    await handlers.handleUpdateTask(taskNoDate);
    expect(apiMock.update).toHaveBeenCalledWith('2026-05-01', expect.objectContaining({ id: '2' }));
  });

  it('handleUpdateTask: falls back to currentDate when neither date nor eventDate present', async () => {
    const active3 = new FakeActive();
    const taskBare = { id: '3', name: 'Bare' };
    const allTasks = ref([taskBare]);
    const { handlers } = {
      handlers: useTaskCrud({
        setCurrentDate: vi.fn(),
        activeGroup: ref({ value: 'g1' }),
        currentDate: ref('2026-01-01'),
        allTasks,
        quasar: { notify: vi.fn() },
        active: active3,
      }),
    };
    const { task: apiMock } = await import('src/CentralController');
    await handlers.handleUpdateTask(taskBare);
    expect(apiMock.update).toHaveBeenCalledWith('2026-01-01', expect.objectContaining({ id: '3' }));
  });

  it('handleUpdateTask: setTask receives the allTasks reference, not the argument object', async () => {
    // allTasks entry is a different object to the argument — setTask should receive the allTasks copy
    const active4 = new FakeActive();
    const storedTask = { id: '1', name: 'Stored version', date: '2026-03-12', extra: 'yes' };
    const allTasks = ref([storedTask]);
    const { handlers } = {
      handlers: useTaskCrud({
        setCurrentDate: vi.fn(),
        activeGroup: ref({ value: 'g1' }),
        currentDate: ref('2026-03-12'),
        allTasks,
        quasar: { notify: vi.fn() },
        active: active4,
      }),
    };
    await handlers.handleUpdateTask({ id: '1', name: 'Incoming version', date: '2026-03-12' });
    // active4.task should have `extra: 'yes'` from allTasks, not from the incoming payload
    // (proves handleUpdateTask looks up the allTasks entry, not just echoes the argument)
    expect(active4.task.value).toMatchObject({ id: '1', name: 'Stored version', extra: 'yes' });
  });

  it('regression: the OLD code (direct destructure) WOULD lose this', () => {
    // Demonstrate the bug the fix addresses:
    // Destructuring a method from a class instance loses `this`.
    const instance = new FakeActive();
    const { setTask } = instance; // ← the old broken pattern
    expect(() => setTask({ id: 'x' })).toThrow();
  });

  it('regression: the NEW code (arrow wrap) preserves this', () => {
    const instance = new FakeActive();
    const safeSetTask = (t: any) => instance.setTask(t);
    expect(() => safeSetTask({ id: 'x' })).not.toThrow();
    expect(instance.task.value).toMatchObject({ id: 'x' });
  });
});
