/**
 * calendarHandlers.spec.ts
 *
 * Unit tests for useCalendarHandlers:
 *  - handleCalendarDateSelect: guards click-block, updates newTask.eventDate, calls setCurrentDate
 *  - handleCalendarEdit: looked up by id, delegates to editTask
 *  - handleCalendarPreview: resolves polymorphic payload, sets task/mode, clears previewTask
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useCalendarHandlers } from '../../src/composables/useCalendarHandlers';

function makeArgs(overrides: Record<string, any> = {}) {
  const isClickBlocked = ref(false);
  const newTask = ref({ eventDate: '2026-01-01' });
  const setCurrentDate = vi.fn();
  const allTasks = ref([
    { id: '1', name: 'Task One', date: '2026-01-01', eventDate: '2026-01-01' },
    { id: '2', name: 'Task Two', date: '2026-01-02', eventDate: '2026-01-02' },
  ]);
  const editTask = vi.fn();
  const setTask = vi.fn();
  const activeMode = ref<'add' | 'edit' | 'preview'>('add');
  const setPreviewTask = vi.fn();

  return {
    ...{
      isClickBlocked,
      newTask,
      setCurrentDate,
      allTasks,
      editTask,
      setTask,
      activeMode,
      setPreviewTask,
    },
    ...overrides,
  };
}

describe('useCalendarHandlers', () => {
  describe('handleCalendarDateSelect', () => {
    it('updates newTask.eventDate and calls setCurrentDate for a new date', () => {
      const args = makeArgs();
      const { handleCalendarDateSelect } = useCalendarHandlers(args);

      handleCalendarDateSelect('2026-03-13');

      expect(args.newTask.value.eventDate).toBe('2026-03-13');
      expect(args.setCurrentDate).toHaveBeenCalledWith('2026-03-13');
    });

    it('briefly blocks clicks during the date selection', () => {
      vi.useFakeTimers();
      const args = makeArgs();
      const { handleCalendarDateSelect } = useCalendarHandlers(args);

      handleCalendarDateSelect('2026-03-13');
      expect(args.isClickBlocked.value).toBe(true);

      vi.runAllTimers();
      expect(args.isClickBlocked.value).toBe(false);
      vi.useRealTimers();
    });

    it('is a no-op when the click is already blocked', () => {
      const args = makeArgs();
      args.isClickBlocked.value = true;
      const { handleCalendarDateSelect } = useCalendarHandlers(args);

      handleCalendarDateSelect('2026-03-13');

      expect(args.setCurrentDate).not.toHaveBeenCalled();
    });

    it('is a no-op when the same date is already set', () => {
      const args = makeArgs();
      args.newTask.value.eventDate = '2026-03-13';
      const { handleCalendarDateSelect } = useCalendarHandlers(args);

      handleCalendarDateSelect('2026-03-13');

      expect(args.setCurrentDate).not.toHaveBeenCalled();
    });
  });

  describe('handleCalendarEdit', () => {
    it('finds a task by id and calls editTask', () => {
      const args = makeArgs();
      const { handleCalendarEdit } = useCalendarHandlers(args);

      handleCalendarEdit('1');

      expect(args.editTask).toHaveBeenCalledWith(args.allTasks.value[0]);
    });

    it('does nothing when taskId is null', () => {
      const args = makeArgs();
      const { handleCalendarEdit } = useCalendarHandlers(args);

      handleCalendarEdit(null);

      expect(args.editTask).not.toHaveBeenCalled();
    });

    it('does nothing when task is not found', () => {
      const args = makeArgs();
      const { handleCalendarEdit } = useCalendarHandlers(args);

      handleCalendarEdit('999');

      expect(args.editTask).not.toHaveBeenCalled();
    });
  });

  describe('handleCalendarPreview', () => {
    it('resolves a string id payload and calls setTask', () => {
      const args = makeArgs();
      const { handleCalendarPreview } = useCalendarHandlers(args);

      handleCalendarPreview('1');

      expect(args.setTask).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
      expect(args.activeMode.value).toBe('preview');
    });

    it('resolves an object payload with .id and merges occurrence date', () => {
      const args = makeArgs();
      const { handleCalendarPreview } = useCalendarHandlers(args);

      handleCalendarPreview({ id: '1', date: '2026-06-15' });

      expect(args.setTask).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', date: '2026-06-15' }),
      );
    });

    it('calls setCurrentDate with the task date', () => {
      const args = makeArgs();
      const { handleCalendarPreview } = useCalendarHandlers(args);

      handleCalendarPreview('1');

      expect(args.setCurrentDate).toHaveBeenCalledWith('2026-01-01');
    });

    it('clears setPreviewTask after handling', () => {
      const args = makeArgs();
      const { handleCalendarPreview } = useCalendarHandlers(args);

      handleCalendarPreview('1');

      expect(args.setPreviewTask).toHaveBeenCalledWith(null);
    });

    it('falls back to editTask when setTask is not provided', () => {
      const args = makeArgs({ setTask: undefined });
      const { handleCalendarPreview } = useCalendarHandlers(args);

      handleCalendarPreview('2');

      expect(args.editTask).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
    });

    it('does nothing for a null payload', () => {
      const args = makeArgs();
      const { handleCalendarPreview } = useCalendarHandlers(args);

      handleCalendarPreview(null);

      expect(args.setTask).not.toHaveBeenCalled();
      expect(args.editTask).not.toHaveBeenCalled();
    });

    it('does nothing when task is not found', () => {
      const args = makeArgs();
      const { handleCalendarPreview } = useCalendarHandlers(args);

      handleCalendarPreview('999');

      expect(args.setTask).not.toHaveBeenCalled();
    });
  });
});
