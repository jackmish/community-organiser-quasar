import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  applyTaskDeletionsToFlatList,
  mergeTasksByNewest,
} from '../../src/modules/storage/sync/organiserLanMerge';
import {
  isTaskBlockedByDeletionTombstone,
  listTaskDeletionsForSync,
  pruneFullyAcknowledgedTaskDeletions,
  type TaskDeletionTombstone,
} from '../../src/modules/storage/sync/taskDeletionLog';
import type { SyncPeerRecord } from '../../src/modules/storage/sync/syncPeerState';

vi.mock('../../src/modules/storage/sync/roleProfileSettings', () => ({
  loadCo21Settings: vi.fn(),
  patchCo21Settings: vi.fn(async () => true),
}));

import { loadCo21Settings } from '../../src/modules/storage/sync/roleProfileSettings';

const basePeer = (id: string, taskSyncedAt: Record<string, number> = {}): SyncPeerRecord => ({
  peerDeviceId: id,
  sessionToken: 'token',
  lastSyncAt: 1,
  lastSyncStatus: 'ok',
  groupSyncedAt: {},
  taskSyncedAt,
});

describe('applyTaskDeletionsToFlatList', () => {
  it('removes tasks when remote deletion is newer', () => {
    const local = [
      { id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', updatedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const out = applyTaskDeletionsToFlatList(local, [
      { id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' },
    ]);
    expect(out.map((t) => t.id)).toEqual(['b']);
  });

  it('keeps task when local updatedAt is newer than deletion', () => {
    const local = [{ id: 'a', updatedAt: '2026-03-01T00:00:00.000Z' }];
    const out = applyTaskDeletionsToFlatList(local, [
      { id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' },
    ]);
    expect(out).toHaveLength(1);
  });
});

describe('mergeTasksByNewest with deletion tombstones', () => {
  const tombstones: Record<string, TaskDeletionTombstone> = {
    a: { id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' },
  };

  it('does not resurrect a locally deleted task from remote payload', () => {
    const remote = [{ id: 'a', name: 'Back', updatedAt: '2026-01-15T00:00:00.000Z' }];
    const out = mergeTasksByNewest([], remote, tombstones);
    expect(out).toHaveLength(0);
  });

  it('allows remote task when it is newer than the tombstone', () => {
    const remote = [{ id: 'a', name: 'Edited again', updatedAt: '2026-03-01T00:00:00.000Z' }];
    const out = mergeTasksByNewest([], remote, tombstones);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('Edited again');
  });
});

describe('listTaskDeletionsForSync', () => {
  beforeEach(() => {
    vi.mocked(loadCo21Settings).mockResolvedValue({
      deletedTaskTombstones: {
        t1: { id: 't1', groupId: 'g1', deletedAt: '2026-02-01T00:00:00.000Z' },
      },
    });
  });

  it('includes pending tombstones on full sync when peer has not acked', async () => {
    const out = await listTaskDeletionsForSync(0, new Set(['g1']), basePeer('peer-b'));
    expect(out.map((t) => t.id)).toEqual(['t1']);
  });

  it('omits tombstones already acked by the peer', async () => {
    const peer = basePeer('peer-b', {
      t1: Date.parse('2026-02-02T00:00:00.000Z'),
    });
    const out = await listTaskDeletionsForSync(0, new Set(['g1']), peer);
    expect(out).toHaveLength(0);
  });
});

describe('pruneFullyAcknowledgedTaskDeletions', () => {
  beforeEach(() => {
    vi.mocked(loadCo21Settings).mockResolvedValue({
      deletedTaskTombstones: {
        t1: { id: 't1', deletedAt: '2026-02-01T00:00:00.000Z' },
      },
    });
  });

  it('removes tombstone only after every contract peer acked', async () => {
    const peers = [
      basePeer('peer-a', { t1: Date.parse('2026-02-02T00:00:00.000Z') }),
      basePeer('peer-b'),
    ];
    await pruneFullyAcknowledgedTaskDeletions(peers, ['peer-a', 'peer-b']);
    const { patchCo21Settings } = await import('../../src/modules/storage/sync/roleProfileSettings');
    expect(patchCo21Settings).not.toHaveBeenCalled();

    await pruneFullyAcknowledgedTaskDeletions(
      [
        basePeer('peer-a', { t1: Date.parse('2026-02-02T00:00:00.000Z') }),
        basePeer('peer-b', { t1: Date.parse('2026-02-02T00:00:00.000Z') }),
      ],
      ['peer-a', 'peer-b'],
    );
    expect(patchCo21Settings).toHaveBeenCalledWith({ deletedTaskTombstones: {} });
  });
});

describe('isTaskBlockedByDeletionTombstone', () => {
  it('blocks when deletion is newer than remote update', () => {
    expect(
      isTaskBlockedByDeletionTombstone(
        'x',
        '2026-01-01T00:00:00.000Z',
        { x: { id: 'x', deletedAt: '2026-02-01T00:00:00.000Z' } },
      ),
    ).toBe(true);
  });
});
