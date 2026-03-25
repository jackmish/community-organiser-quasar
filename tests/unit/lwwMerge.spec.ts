import { describe, it, expect } from 'vitest';
import { merge, applyEntriesToRecord } from 'src/modules/storage/sync/lwwMerge';
import type { ChangeEntry } from 'src/modules/storage/sync/ChangeEntry';

// Helper to build a ChangeEntry without boilerplate.
function entry(
  overrides: Partial<ChangeEntry> & {
    field: string;
    value: unknown;
    entityId?: string;
  },
): ChangeEntry {
  return {
    id: overrides.id ?? `${overrides.deviceId ?? 'dev-A'}-${overrides.clock ?? 1}`,
    deviceId: overrides.deviceId ?? 'dev-A',
    timestamp: overrides.timestamp ?? '2024-01-01T00:00:00.000Z',
    clock: overrides.clock ?? 1,
    entityType: overrides.entityType ?? 'task',
    entityId: overrides.entityId ?? 'entity-1',
    field: overrides.field,
    value: overrides.value,
    previousValue: overrides.previousValue,
  };
}

// ─── merge() ───────────────────────────────────────────────────────────────

describe('merge()', () => {
  it('applies a remote entry when the local log has nothing for that field', () => {
    const remote = entry({ field: 'title', value: 'Remote title', deviceId: 'dev-B', clock: 1 });
    const result = merge([], [remote]);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]).toMatchObject({ field: 'title', value: 'Remote title' });
    expect(result.conflicts).toHaveLength(0);
  });

  it('applies both entries when they touch different fields', () => {
    const local = entry({ field: 'title', value: 'Local', deviceId: 'dev-A', clock: 2 });
    const remote = entry({ field: 'description', value: 'Remote', deviceId: 'dev-B', clock: 2 });

    const result = merge([local], [remote]);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].field).toBe('description');
    expect(result.conflicts).toHaveLength(0);
  });

  it('remote wins when its timestamp is newer', () => {
    const local = entry({
      field: 'title',
      value: 'Old',
      deviceId: 'dev-A',
      clock: 1,
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    const remote = entry({
      field: 'title',
      value: 'New',
      deviceId: 'dev-B',
      clock: 1,
      timestamp: '2024-01-02T00:00:00.000Z',
    });

    const result = merge([local], [remote]);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].value).toBe('New');
    expect(result.conflicts).toHaveLength(0);
  });

  it('local wins when its timestamp is newer → remote entry is NOT applied', () => {
    const local = entry({
      field: 'title',
      value: 'Local newer',
      deviceId: 'dev-A',
      clock: 1,
      timestamp: '2024-01-03T00:00:00.000Z',
    });
    const remote = entry({
      field: 'title',
      value: 'Remote older',
      deviceId: 'dev-B',
      clock: 1,
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    const result = merge([local], [remote]);

    // Remote is stale — nothing new to apply.
    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('uses logical clock as tiebreaker when timestamps are identical', () => {
    const ts = '2024-01-01T00:00:00.000Z';
    const local = entry({
      field: 'title',
      value: 'Low clock',
      deviceId: 'dev-A',
      clock: 1,
      timestamp: ts,
    });
    const remote = entry({
      field: 'title',
      value: 'High clock',
      deviceId: 'dev-B',
      clock: 5,
      timestamp: ts,
    });

    const result = merge([local], [remote]);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].value).toBe('High clock');
  });

  it('uses deviceId as final tiebreaker when timestamp and clock are identical', () => {
    const ts = '2024-01-01T00:00:00.000Z';
    // 'zzz-device' > 'aaa-device' lexicographically → 'zzz-device' wins.
    const local = entry({
      field: 'title',
      value: 'aaa value',
      deviceId: 'aaa-device',
      clock: 1,
      timestamp: ts,
    });
    const remote = entry({
      field: 'title',
      value: 'zzz value',
      deviceId: 'zzz-device',
      clock: 1,
      timestamp: ts,
    });

    const result = merge([local], [remote]);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].value).toBe('zzz value');
  });

  it('merges multiple entities independently', () => {
    const localA = entry({
      entityId: 'entity-A',
      field: 'title',
      value: 'A local',
      deviceId: 'dev-A',
      clock: 3,
    });
    const remoteB = entry({
      entityId: 'entity-B',
      field: 'title',
      value: 'B remote',
      deviceId: 'dev-B',
      clock: 3,
    });

    const result = merge([localA], [remoteB]);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].entityId).toBe('entity-B');
  });

  it('deduplicates entries: remote entry already in local log is not double-applied', () => {
    const shared = entry({
      id: 'shared-id',
      field: 'title',
      value: 'same',
      deviceId: 'dev-B',
      clock: 5,
    });

    const result = merge([shared], [shared]);

    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('mergedLog contains all unique entries regardless of which side won', () => {
    const local = entry({ field: 'title', value: 'Local', deviceId: 'dev-A', clock: 2 });
    const remoteOld = entry({ field: 'title', value: 'Remote old', deviceId: 'dev-B', clock: 1 });

    const result = merge([local], [remoteOld]);

    const ids = result.mergedLog.map((e) => e.id);
    expect(ids).toContain(local.id);
    expect(ids).toContain(remoteOld.id);
  });
});

// ─── applyEntriesToRecord() ─────────────────────────────────────────────────

describe('applyEntriesToRecord()', () => {
  it('applies field values to a record', () => {
    const record = { title: 'old', status: 'todo' };
    const entries = [
      entry({ field: 'title', value: 'new title' }),
      entry({ field: 'status', value: 'done' }),
    ];

    const result = applyEntriesToRecord(record, entries);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('new title');
    expect(result?.status).toBe('done');
  });

  it('returns null when a $entity delete sentinel is present', () => {
    const record = { title: 'something' };
    const entries = [entry({ field: '$entity', value: null })];

    expect(applyEntriesToRecord(record, entries)).toBeNull();
  });

  it('returns a shallow copy, not a mutation of the original', () => {
    const original = { title: 'original' };
    const entries = [entry({ field: 'title', value: 'updated' })];

    const result = applyEntriesToRecord(original, entries);

    expect(original.title).toBe('original');
    expect(result?.title).toBe('updated');
  });

  it('returns the record unchanged when entries list is empty', () => {
    const record = { title: 'untouched' };

    const result = applyEntriesToRecord(record, []);

    expect(result).toEqual(record);
  });
});
