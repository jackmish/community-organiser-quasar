import { describe, it, expect } from 'vitest';
import {
  buildPlanningDayOverlay,
  getMostPessimisticStatus,
  getTopPriorityNotes,
  normalizePlanningDayEntry,
  buildDayPlanningSchedule,
  scheduleHasPlanningData,
  scheduleHasPlanningContent,
  orderPlanningNotesForDisplay,
  toPersistedPlanningDayEntry,
  listPlanningTagImportCandidates,
  mergeImportedPlanningTags,
} from '../../src/modules/task/dayPlanning/dayPlanningUtils';
import { formatPlanningNoteDisplayText } from '../../src/modules/task/dayPlanning/dayPlanningTypes';

describe('dayPlanningUtils', () => {
  it('picks most pessimistic status', () => {
    const notes = [
      { id: '1', tagId: '__default__', text: 'ok', status: 'probable' as const },
      { id: '2', tagId: '__default__', text: 'hard', status: 'tricky' as const },
      { id: '3', tagId: '__default__', text: 'no', status: 'important' as const },
    ];
    expect(getMostPessimisticStatus(notes)).toBe('important');
    expect(getTopPriorityNotes(notes).map((n) => n.id)).toEqual(['3']);
  });

  it('returns all notes at top priority', () => {
    const notes = [
      { id: 'a', tagId: 't1', text: 'one', status: 'tricky' as const },
      { id: 'b', tagId: 't2', text: 'two', status: 'tricky' as const },
      { id: 'c', tagId: 't1', text: 'three', status: 'probable' as const },
    ];
    expect(getTopPriorityNotes(notes).map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('orders soft-removed notes at the end and excludes them from persist', () => {
    const entry = normalizePlanningDayEntry({
      notes: [
        { id: '1', tagId: '__default__', text: 'a', status: 'probable' },
        { id: '2', tagId: '__default__', text: 'b', status: 'important' },
      ],
    });
    entry.notes[0]!.pendingRemoval = true;
    const ordered = orderPlanningNotesForDisplay(entry.notes);
    expect(ordered.map((n) => n.id)).toEqual(['2', '1']);
    const overlay = buildPlanningDayOverlay(entry, []);
    expect(overlay?.badges.map((b) => b.text)).toEqual(['b']);
    const persisted = toPersistedPlanningDayEntry(entry);
    expect(persisted?.notes?.map((n) => n.id)).toEqual(['2']);
  });

  it('sorts all notes by priority for overlay badges', () => {
    const entry = normalizePlanningDayEntry({
      notes: [
        { id: '1', tagId: '__default__', text: 'ok', status: 'probable' },
        { id: '2', tagId: '__default__', text: 'hard', status: 'tricky' },
        { id: '3', tagId: '__default__', text: 'no', status: 'important' },
      ],
    });
    const overlay = buildPlanningDayOverlay(entry, []);
    expect(overlay?.badges.map((b) => b.text)).toEqual(['no', 'hard', 'ok']);
    expect(overlay?.statuses).toEqual(['important', 'tricky', 'probable']);
  });

  it('builds overlay with strikethrough for important', () => {
    const entry = normalizePlanningDayEntry({
      notes: [{ id: '1', tagId: '__default__', text: 'Must avoid', status: 'important' }],
    });
    const overlay = buildPlanningDayOverlay(entry, []);
    expect(overlay?.strikethrough).toBe(true);
    expect(overlay?.badges[0]?.text).toBe('Must avoid');
    expect(overlay?.statuses).toEqual(['important']);
  });

  it('migrates legacy single note field', () => {
    const entry = normalizePlanningDayEntry({ note: 'Legacy note' });
    expect(entry.notes).toHaveLength(1);
    expect(entry.notes[0]?.text).toBe('Legacy note');
    expect(entry.notes[0]?.status).toBe('probable');
  });

  it('persists notes mode even without tags or day entries', () => {
    const schedule = buildDayPlanningSchedule([], {}, { persistNotesMode: true });
    expect(schedule).toEqual({ mode: 'notes', tags: [], days: {} });
    expect(scheduleHasPlanningData(schedule)).toBe(true);
    expect(scheduleHasPlanningContent(schedule)).toBe(false);
  });

  it('lists import candidates by type and search', () => {
    const tasks = [
      {
        id: '1',
        name: 'Alpha meet',
        type_id: 'TimeEvent',
        dayPlanning: { mode: 'notes' as const, tags: [{ id: 't1', label: 'Anna' }], days: {} },
      },
      {
        id: '2',
        name: 'Beta meet',
        type_id: 'TimeEvent',
        dayPlanning: { mode: 'notes' as const, tags: [{ id: 't2', label: 'Bob' }], days: {} },
      },
      {
        id: '3',
        name: 'Todo item',
        type_id: 'Todo',
        dayPlanning: { mode: 'notes' as const, tags: [{ id: 't3', label: 'X' }], days: {} },
      },
    ];
    const filtered = listPlanningTagImportCandidates(tasks, {
      sourceTaskId: '9',
      typeId: 'TimeEvent',
      search: 'beta',
    });
    expect(filtered.map((t) => t.id)).toEqual(['2']);
    expect(filtered[0]?.tags.map((t) => t.label)).toEqual(['Bob']);
  });

  it('merges imported tags without duplicating labels', () => {
    const merged = mergeImportedPlanningTags(
      [{ id: 'a', label: 'Anna' }],
      [
        { id: 'b', label: 'anna' },
        { id: 'c', label: 'Chris' },
      ],
      () => 'new-id',
    );
    expect(merged).toEqual([
      { id: 'a', label: 'Anna' },
      { id: 'new-id', label: 'Chris' },
    ]);
  });
});

describe('formatPlanningNoteDisplayText', () => {
  it('shows placeholder for empty note text without persisting it', () => {
    expect(formatPlanningNoteDisplayText('')).toBe('---');
    expect(formatPlanningNoteDisplayText('  ')).toBe('---');
    expect(formatPlanningNoteDisplayText('real note')).toBe('real note');
  });
});
