import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_TODO_SCHEDULE_PICK_MODE,
  TODO_SCHEDULE_DRAFT_ID,
  todoCalendarSchedule,
} from '../../src/composables/useTodoCalendarSchedule';

describe('useTodoCalendarSchedule pickMode', () => {
  afterEach(() => {
    todoCalendarSchedule.cancel();
  });

  it('defaults to day choice', () => {
    expect(DEFAULT_TODO_SCHEDULE_PICK_MODE).toBe('day');
    expect(todoCalendarSchedule.pickMode.value).toBe('day');
  });

  it('resets to day choice when scheduling starts', () => {
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.start({ id: 'task-1', name: 'Meeting' });
    expect(todoCalendarSchedule.pickMode.value).toBe('day');
  });

  it('resets to day choice for draft scheduling', () => {
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.startDraft({ name: 'Draft meeting' });
    expect(todoCalendarSchedule.pickMode.value).toBe('day');
    expect(todoCalendarSchedule.sourceTask.value?.id).toBe(TODO_SCHEDULE_DRAFT_ID);
  });

  it('resets to day choice on cancel', () => {
    todoCalendarSchedule.start({ id: 'task-2' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.cancel();
    expect(todoCalendarSchedule.pickMode.value).toBe('day');
    expect(todoCalendarSchedule.active.value).toBe(false);
  });
});
