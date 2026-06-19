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
    expect(todoCalendarSchedule.sessionKey.value).toBeGreaterThan(0);
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

  it('loads existing meeting schedule in notes mode', () => {
    todoCalendarSchedule.start({
      id: 'task-3',
      meetingSchedule: {
        mode: 'notes',
        days: {
          '2026-06-20': { possible: true, note: 'Morning works' },
        },
      },
    });
    expect(todoCalendarSchedule.pickMode.value).toBe('notes');
    expect(todoCalendarSchedule.scheduleDayMarks.value['2026-06-20']?.possible).toBe(true);
  });

  it('opens day editor and stores marks in notes mode', () => {
    todoCalendarSchedule.start({ id: 'task-4' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.openDayEditor('2026-06-21');
    expect(todoCalendarSchedule.editingDay.value).toBe('2026-06-21');
    todoCalendarSchedule.setDayPossible('2026-06-21', true);
    todoCalendarSchedule.setDayNote('2026-06-21', 'After lunch');
    const schedule = todoCalendarSchedule.buildMeetingSchedule();
    expect(schedule?.days['2026-06-21']).toEqual({
      possible: true,
      note: 'After lunch',
    });
  });

  it('marks impossible days and clears possible flag', () => {
    todoCalendarSchedule.start({ id: 'task-5' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.setDayPossible('2026-06-22', true);
    todoCalendarSchedule.setDayImpossible('2026-06-22', true);
    expect(todoCalendarSchedule.scheduleDayMarks.value['2026-06-22']).toEqual({
      possible: false,
      impossible: true,
    });
  });
});
