import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_TODO_SCHEDULE_PICK_MODE,
  TODO_SCHEDULE_DRAFT_ID,
  todoCalendarSchedule,
} from '../../src/composables/useTodoCalendarSchedule';
import { DEFAULT_PLANNING_TAG_ID } from '../../src/modules/task/dayPlanning/dayPlanningTypes';

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

  it('loads planning notes in notes mode', () => {
    todoCalendarSchedule.start({
      id: 'task-3',
      dayPlanning: {
        mode: 'notes',
        tags: [{ id: 'tag-1', label: 'Anna' }],
        days: {
          '2026-06-20': {
            possible: true,
            notes: [
              {
                id: 'n1',
                tagId: 'tag-1',
                text: 'Morning works',
                status: 'probable',
              },
            ],
          },
        },
      },
    });
    expect(todoCalendarSchedule.pickMode.value).toBe('notes');
    expect(todoCalendarSchedule.scheduleDayMarks.value['2026-06-20']?.possible).toBe(true);
    expect(todoCalendarSchedule.planningDayOverlays.value['2026-06-20']?.badges[0]?.text).toBe(
      'Morning works',
    );
  });

  it('adds tags and notes for a day', () => {
    todoCalendarSchedule.start({ id: 'task-4' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.addPlanningTag('Anna');
    todoCalendarSchedule.openDayEditor('2026-06-21');
    todoCalendarSchedule.addPlanningNote('2026-06-21', 'After lunch', 'tricky');
    const schedule = todoCalendarSchedule.buildDayPlanning();
    expect(schedule?.tags.some((t) => t.label === 'Anna')).toBe(true);
    expect(schedule?.days['2026-06-21']?.notes?.[0]?.status).toBe('tricky');
  });

  it('uses default tag when none selected', () => {
    todoCalendarSchedule.start({ id: 'task-5' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.setSelectedTagId(DEFAULT_PLANNING_TAG_ID);
    todoCalendarSchedule.addPlanningNote('2026-06-22', 'General note');
    const note = todoCalendarSchedule.dayEntries.value['2026-06-22']?.notes[0];
    expect(note?.tagId).toBe(DEFAULT_PLANNING_TAG_ID);
  });

  it('allows status-only note without description', () => {
    todoCalendarSchedule.start({ id: 'task-5b' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.addPlanningNote('2026-06-24', '', 'important');
    const note = todoCalendarSchedule.dayEntries.value['2026-06-24']?.notes[0];
    expect(note?.text).toBe('');
    expect(note?.status).toBe('important');
    expect(todoCalendarSchedule.planningDayOverlays.value['2026-06-24']?.strikethrough).toBe(true);
  });

  it('resets session on cancel so notes are not shared', () => {
    todoCalendarSchedule.start({ id: 'task-6' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.addPlanningNote('2026-06-23', 'Private');
    todoCalendarSchedule.cancel();
    todoCalendarSchedule.start({ id: 'task-7' });
    expect(todoCalendarSchedule.dayEntries.value['2026-06-23']).toBeUndefined();
  });

  it('loads notes mode from saved task even with empty planning data', () => {
    todoCalendarSchedule.start({
      id: 'task-empty-notes',
      dayPlanning: { mode: 'notes', tags: [], days: {} },
    });
    expect(todoCalendarSchedule.pickMode.value).toBe('notes');
  });

  it('resets to day choice for draft scheduling', () => {
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.startDraft({ name: 'Draft meeting' });
    expect(todoCalendarSchedule.pickMode.value).toBe('day');
    expect(todoCalendarSchedule.sourceTask.value?.id).toBe(TODO_SCHEDULE_DRAFT_ID);
  });
});
