import { describe, expect, it } from 'vitest';
import {
  mergeTasksByNewest,
  taskPayloadFromFlat,
} from '../../src/modules/storage/sync/organiserLanMerge';
import type { DayPlanningSchedule } from '../../src/modules/task/dayPlanning/dayPlanningTypes';

const samplePlanning: DayPlanningSchedule = {
  mode: 'notes',
  tags: [{ id: 'alice', label: 'Alice' }],
  days: {
    '2026-06-15': {
      possible: true,
      notes: [
        {
          id: 'n1',
          tagId: 'alice',
          text: 'Bring snacks',
          status: 'important',
        },
      ],
    },
  },
};

describe('taskPayloadFromFlat', () => {
  it('includes day planning tags and notes in sync payload', () => {
    const payload = taskPayloadFromFlat({
      id: 'task-1',
      name: 'Meeting',
      updatedAt: '2026-06-15T12:00:00.000Z',
      dayPlanning: samplePlanning,
    });

    expect(payload.dayPlanning).toEqual(samplePlanning);
    expect(payload.meetingSchedule).toEqual(samplePlanning);
  });

  it('reads planning from legacy meetingSchedule field', () => {
    const payload = taskPayloadFromFlat({
      id: 'task-2',
      meetingSchedule: samplePlanning,
    });

    expect(payload.dayPlanning).toEqual(samplePlanning);
    expect(payload.meetingSchedule).toEqual(samplePlanning);
  });

  it('emits null planning when explicitly cleared', () => {
    const payload = taskPayloadFromFlat({
      id: 'task-3',
      dayPlanning: null,
      meetingSchedule: null,
    });

    expect(payload.dayPlanning).toBeNull();
    expect(payload.meetingSchedule).toBeNull();
  });
});

describe('mergeTasksByNewest with day planning', () => {
  it('merges remote planning when remote task is newer', () => {
    const local = [
      {
        id: 'task-1',
        name: 'Local',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ];
    const remote = [
      {
        id: 'task-1',
        name: 'Remote',
        updatedAt: '2026-06-15T00:00:00.000Z',
        dayPlanning: samplePlanning,
      },
    ];

    const merged = mergeTasksByNewest(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.dayPlanning).toEqual(samplePlanning);
    expect(merged[0]?.name).toBe('Remote');
  });

  it('keeps local planning when local task is newer', () => {
    const localPlanning: DayPlanningSchedule = {
      ...samplePlanning,
      tags: [{ id: 'bob', label: 'Bob' }],
    };
    const local = [
      {
        id: 'task-1',
        name: 'Local',
        updatedAt: '2026-06-20T00:00:00.000Z',
        dayPlanning: localPlanning,
      },
    ];
    const remote = [
      {
        id: 'task-1',
        name: 'Remote',
        updatedAt: '2026-06-15T00:00:00.000Z',
        dayPlanning: samplePlanning,
      },
    ];

    const merged = mergeTasksByNewest(local, remote);
    expect(merged[0]?.dayPlanning).toEqual(localPlanning);
  });
});
