import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_TODO_SCHEDULE_PICK_MODE,
  TODO_SCHEDULE_DRAFT_ID,
  rememberTodoSchedulePickMode,
  resetRememberedTodoSchedulePickMode,
  todoCalendarSchedule,
} from '../../src/composables/useTodoCalendarSchedule';
import { DEFAULT_PLANNING_TAG_ID } from '../../src/modules/task/dayPlanning/dayPlanningTypes';

describe('useTodoCalendarSchedule pickMode', () => {
  afterEach(() => {
    todoCalendarSchedule.cancel();
    resetRememberedTodoSchedulePickMode();
  });

  it('defaults to day choice', () => {
    expect(DEFAULT_TODO_SCHEDULE_PICK_MODE).toBe('day');
    expect(todoCalendarSchedule.pickMode.value).toBe('day');
  });

  it('uses day choice when scheduling starts without saved planning', () => {
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.start({ id: 'task-1', name: 'Meeting' });
    expect(todoCalendarSchedule.pickMode.value).toBe('day');
  });

  it('restores last saved pick mode for new scheduling sessions', () => {
    rememberTodoSchedulePickMode('notes');
    todoCalendarSchedule.start({ id: 'task-1b', name: 'Meeting' });
    expect(todoCalendarSchedule.pickMode.value).toBe('notes');
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

  it('soft-removes notes until save and can restore', () => {
    todoCalendarSchedule.start({ id: 'task-8' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.addPlanningNote('2026-06-25', 'keep', 'probable');
    todoCalendarSchedule.addPlanningNote('2026-06-25', 'drop', 'tricky');
    const dropId = todoCalendarSchedule.dayEntries.value['2026-06-25']?.notes.find(
      (n) => n.text === 'drop',
    )?.id;
    expect(dropId).toBeTruthy();
    todoCalendarSchedule.softRemovePlanningNote('2026-06-25', dropId!);
    expect(todoCalendarSchedule.planningDayOverlays.value['2026-06-25']?.badges).toHaveLength(1);
    expect(todoCalendarSchedule.buildDayPlanning()?.days['2026-06-25']?.notes).toHaveLength(1);
    todoCalendarSchedule.restorePlanningNote('2026-06-25', dropId!);
    expect(todoCalendarSchedule.buildDayPlanning()?.days['2026-06-25']?.notes).toHaveLength(2);
  });

  it('updates an existing planning note', () => {
    todoCalendarSchedule.start({ id: 'task-9' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.addPlanningNote('2026-06-26', 'old', 'probable');
    const id = todoCalendarSchedule.dayEntries.value['2026-06-26']?.notes[0]?.id;
    todoCalendarSchedule.updatePlanningNote('2026-06-26', id!, 'new', 'important');
    const note = todoCalendarSchedule.dayEntries.value['2026-06-26']?.notes[0];
    expect(note?.text).toBe('new');
    expect(note?.status).toBe('important');
  });

  it('imports planning tags without copying day notes', () => {
    todoCalendarSchedule.start({ id: 'task-10', type_id: 'TimeEvent' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.importPlanningTags([
      { id: 'foreign-1', label: 'Anna' },
      { id: 'foreign-2', label: 'Bob' },
    ]);
    expect(todoCalendarSchedule.planningTags.value.map((t) => t.label)).toEqual(['Anna', 'Bob']);
    expect(Object.keys(todoCalendarSchedule.dayEntries.value)).toHaveLength(0);
  });

  it('renames and removes planning tags', () => {
    todoCalendarSchedule.start({ id: 'task-11' });
    todoCalendarSchedule.pickMode.value = 'notes';
    todoCalendarSchedule.addPlanningTag('Anna');
    const tagId = todoCalendarSchedule.planningTags.value[0]!.id;
    todoCalendarSchedule.addPlanningNote('2026-06-27', 'Note', 'probable');
    todoCalendarSchedule.updatePlanningTag(tagId, 'Ann');
    expect(todoCalendarSchedule.planningTags.value[0]?.label).toBe('Ann');
    todoCalendarSchedule.removePlanningTag(tagId);
    expect(todoCalendarSchedule.planningTags.value).toHaveLength(0);
    expect(todoCalendarSchedule.selectedTagId.value).toBe(DEFAULT_PLANNING_TAG_ID);
    expect(todoCalendarSchedule.dayEntries.value['2026-06-27']?.notes[0]?.tagId).toBe(
      DEFAULT_PLANNING_TAG_ID,
    );
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

  it('uses last saved pick mode for draft scheduling', () => {
    rememberTodoSchedulePickMode('notes');
    todoCalendarSchedule.startDraft({ name: 'Draft meeting' });
    expect(todoCalendarSchedule.pickMode.value).toBe('notes');
    expect(todoCalendarSchedule.sourceTask.value?.id).toBe(TODO_SCHEDULE_DRAFT_ID);
  });

  it('prefills schedule description from task', () => {
    todoCalendarSchedule.start({
      id: 'task-desc',
      description: 'Bring documents',
    });
    expect(todoCalendarSchedule.scheduleDescription.value).toBe('Bring documents');
  });

  it('syncs schedule description to source task and apply payload', () => {
    todoCalendarSchedule.start({
      id: 'task-desc-sync',
      description: 'Initial',
    });
    todoCalendarSchedule.scheduleDescription.value = 'Updated in planner';
    todoCalendarSchedule.pickDay('2026-07-01');
    todoCalendarSchedule.scheduleHour.value = 9;
    todoCalendarSchedule.scheduleMinute.value = 30;
    todoCalendarSchedule.syncSourceTaskScheduleFields();
    expect(todoCalendarSchedule.sourceTask.value?.description).toBe('Updated in planner');
    expect(todoCalendarSchedule.sourceTask.value?.name).toBe('Updated in planner');
    expect(todoCalendarSchedule.sourceTask.value?.eventDate).toBe('2026-07-01');
    expect(todoCalendarSchedule.sourceTask.value?.eventTime).toBe('09:30');
    expect(todoCalendarSchedule.getScheduleDescription()).toBe('Updated in planner');
  });
});
