import { describe, expect, it } from 'vitest';
import { applyTaskDeletionsToFlatList } from '../../src/modules/storage/sync/organiserLanMerge';

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
