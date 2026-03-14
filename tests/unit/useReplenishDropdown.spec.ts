/**
 * useReplenishDropdown.spec.ts
 *
 * Unit tests for the useReplenishDropdown composable extracted from AddTaskForm.vue.
 *
 * Pure-logic coverage (no DOM required):
 *  - replenishMatches: filters allTasks to Replenish type + query
 *  - smallReplenishTasks: prefers replenishTasks prop, falls back to allTasks filter
 *  - replenishAlreadyAdded: date-aware duplicate detection
 *  - createReplenishFromInput: emits add-task and resets query
 *  - selectReplenishMatch: calls updateTask + emits cancel-edit
 *  - onReplenishInput: shows/hides list based on value
 *  - auto-capitalize watch on replenishQuery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick, defineComponent, createApp } from 'vue';
import { useReplenishDropdown } from '../../src/composables/useReplenishDropdown';
import type { UseReplenishDropdownOptions } from '../../src/composables/useReplenishDropdown';

// ─── withSetup helper ─────────────────────────────────────────────────────────
// Mounts a throw-away Vue component so onMounted/onBeforeUnmount are in a
// proper component context. Returns the composable's return value.
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const TestComponent = defineComponent({
    setup() {
      result = composable();
      return {};
    },
    template: '<div></div>',
  });
  const div = document.createElement('div');
  const app = createApp(TestComponent);
  app.mount(div);
  return { result, unmount: () => app.unmount() };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REPLENISH_TASKS = [
  { id: 'r1', name: 'Milk', type_id: 'Replenish', eventDate: '2026-06-15' },
  { id: 'r2', name: 'Eggs', type_id: 'Replenish', eventDate: '2026-06-16' },
  { id: 'r3', name: 'Bread', type_id: 'Replenish', eventDate: '2026-06-15' },
];

const OTHER_TASKS = [{ id: 't1', name: 'Meeting', type_id: 'TimeEvent', eventDate: '2026-06-15' }];

const ALL_TASKS = [...REPLENISH_TASKS, ...OTHER_TASKS];

function makeOptions(
  overrides: Partial<UseReplenishDropdownOptions> = {},
): UseReplenishDropdownOptions {
  const localNewTask = ref({
    name: '',
    type_id: 'Replenish',
    status_id: 1,
    description: '',
    eventDate: '2026-06-15',
    groupId: undefined as string | undefined,
  });
  const allTasks = ref(ALL_TASKS);
  const replenishTasks = ref<any[]>([]);
  const selectedDate = ref('2026-06-15');
  const stayAfterSave = ref(false);
  const emit = vi.fn();
  const updateTask = vi.fn().mockResolvedValue(undefined);

  return {
    localNewTask,
    allTasks,
    replenishTasks,
    selectedDate,
    stayAfterSave,
    emit,
    updateTask,
    ...overrides,
  } as UseReplenishDropdownOptions;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useReplenishDropdown', () => {
  describe('replenishMatches', () => {
    it('returns all Replenish tasks when query is empty', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      expect(result.replenishMatches.value).toHaveLength(3);
      unmount();
    });

    it('filters by query (case-insensitive)', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = 'mi';
      expect(result.replenishMatches.value).toHaveLength(1);
      expect(result.replenishMatches.value[0]?.name).toBe('Milk');
      unmount();
    });

    it('excludes non-Replenish tasks regardless of query', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = 'meeting';
      expect(result.replenishMatches.value).toHaveLength(0);
      unmount();
    });
  });

  describe('smallReplenishTasks', () => {
    it('prefers replenishTasks prop when non-empty', () => {
      const preFiltered = [
        { id: 'r1', name: 'Milk', type_id: 'Replenish', eventDate: '2026-06-15' },
      ];
      const opts = makeOptions({ replenishTasks: ref(preFiltered) as any });
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      expect(result.smallReplenishTasks.value).toHaveLength(1);
      unmount();
    });

    it('falls back to allTasks filter when replenishTasks is empty', () => {
      const opts = makeOptions({ replenishTasks: ref([]) as any });
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      expect(result.smallReplenishTasks.value).toHaveLength(3);
      unmount();
    });
  });

  describe('replenishAlreadyAdded', () => {
    it('returns false for unknown task names', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      expect(result.replenishAlreadyAdded({ id: 'new', name: 'Butter' })).toBe(false);
      unmount();
    });

    it('returns true for exact id match', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      expect(result.replenishAlreadyAdded({ id: 'r1', name: 'Milk' })).toBe(true);
      unmount();
    });

    it('returns true for same name on the selected date', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      // Milk is in allTasks with eventDate 2026-06-15. Task without id match
      expect(result.replenishAlreadyAdded({ id: 'unknown', name: 'Milk' })).toBe(true);
      unmount();
    });

    it('returns false when same name but different date', () => {
      const opts = makeOptions({ selectedDate: ref('2026-07-01') as any });
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      expect(result.replenishAlreadyAdded({ id: 'unknown', name: 'Milk' })).toBe(false);
      unmount();
    });

    it('returns false for empty name', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      expect(result.replenishAlreadyAdded({ name: '' })).toBe(false);
      unmount();
    });
  });

  describe('createReplenishFromInput', () => {
    it('sets task name and type, then emits add-task', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = 'Butter';
      result.createReplenishFromInput();
      expect((opts.localNewTask as any).value.name).toBe('Butter');
      expect((opts.localNewTask as any).value.type_id).toBe('Replenish');
      expect(opts.emit).toHaveBeenCalledWith(
        'add-task',
        expect.objectContaining({ name: 'Butter' }),
        expect.anything(),
      );
      unmount();
    });

    it('resets replenishQuery and hides list after creating', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = 'Butter';
      result.showReplenishList.value = true;
      result.createReplenishFromInput();
      expect(result.replenishQuery.value).toBe('');
      expect(result.showReplenishList.value).toBe(false);
      unmount();
    });

    it('does nothing when query is empty', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = '';
      result.createReplenishFromInput();
      expect(opts.emit).not.toHaveBeenCalled();
      unmount();
    });

    it('passes preview: true to emit when stayAfterSave is false', () => {
      const opts = makeOptions({ stayAfterSave: ref(false) as any });
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = 'Sugar';
      result.createReplenishFromInput();
      expect(opts.emit).toHaveBeenCalledWith('add-task', expect.anything(), { preview: true });
      unmount();
    });

    it('passes preview: false to emit when stayAfterSave is true', () => {
      const opts = makeOptions({ stayAfterSave: ref(true) as any });
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = 'Sugar';
      result.createReplenishFromInput();
      expect(opts.emit).toHaveBeenCalledWith('add-task', expect.anything(), { preview: false });
      unmount();
    });
  });

  describe('selectReplenishMatch', () => {
    it('calls updateTask with the correct date and sets status_id to 1', async () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      const task = REPLENISH_TASKS[0]!;
      await result.selectReplenishMatch(task);
      expect(opts.updateTask).toHaveBeenCalledWith(task.eventDate, task.id, { status_id: 1 });
      unmount();
    });

    it('emits cancel-edit after a successful update', async () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      await result.selectReplenishMatch(REPLENISH_TASKS[0]!);
      expect(opts.emit).toHaveBeenCalledWith('cancel-edit');
      unmount();
    });

    it('resets replenishQuery and hides list after selection', async () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.showReplenishList.value = true;
      result.replenishQuery.value = 'Milk';
      await result.selectReplenishMatch(REPLENISH_TASKS[0]!);
      expect(result.replenishQuery.value).toBe('');
      expect(result.showReplenishList.value).toBe(false);
      unmount();
    });
  });

  describe('onReplenishInput', () => {
    it('shows list when input has non-empty value', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.onReplenishInput('mi');
      expect(result.showReplenishList.value).toBe(true);
      unmount();
    });

    it('hides list when input is empty', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.showReplenishList.value = true;
      result.onReplenishInput('');
      expect(result.showReplenishList.value).toBe(false);
      unmount();
    });

    it('hides list when input is null', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.showReplenishList.value = true;
      result.onReplenishInput(null);
      expect(result.showReplenishList.value).toBe(false);
      unmount();
    });

    it('hides list and sets replenishListStyle to display:none on empty input', () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.onReplenishInput('');
      expect(result.replenishListStyle.value).toMatchObject({ display: 'none' });
      unmount();
    });
  });

  describe('auto-capitalize watcher', () => {
    it('capitalizes the first letter of replenishQuery', async () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = 'milk';
      await nextTick();
      expect(result.replenishQuery.value).toBe('Milk');
      unmount();
    });

    it('does not change an already-capitalised value', async () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = 'Milk';
      await nextTick();
      expect(result.replenishQuery.value).toBe('Milk');
      unmount();
    });

    it('does nothing when query is empty', async () => {
      const opts = makeOptions();
      const { result, unmount } = withSetup(() => useReplenishDropdown(opts));
      result.replenishQuery.value = '';
      await nextTick();
      expect(result.replenishQuery.value).toBe('');
      unmount();
    });
  });
});
