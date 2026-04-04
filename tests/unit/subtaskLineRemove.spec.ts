/**
 * subtaskLineRemove.spec.ts
 *
 * Tests for the SubtaskLineRepository.remove / removeCompute logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { SubtaskLineRepository } from '../../src/modules/task/managers/subtaskLine/subtaskLineRepository';

function makeManager(activeTask = { value: null as any }) {
  return {
    timeProvider: {
      state: activeTask,
      time: { currentDate: { value: '2026-04-04' } },
    },
    updateTask: vi.fn(async () => {}),
  } as any;
}

function makeTask(description: string) {
  return { id: '1', name: 'Task', description, date: '2026-04-04', updatedAt: '' } as any;
}

describe('SubtaskLineRepository.remove', () => {
  it('removes the line at the given index', async () => {
    const manager = makeManager();
    const repo = new SubtaskLineRepository(manager);

    const task = makeTask('- [ ] first\n- [ ] second\n- [ ] third');
    const result = await repo.remove(task, 1);

    expect(result).not.toBeNull();
    expect(result!.newDesc).toBe('- [ ] first\n- [ ] third');
    expect(manager.updateTask).toHaveBeenCalledTimes(1);
  });

  it('removes the first line', async () => {
    const manager = makeManager();
    const repo = new SubtaskLineRepository(manager);

    const task = makeTask('- [ ] first\n- [ ] second');
    const result = await repo.remove(task, 0);

    expect(result!.newDesc).toBe('- [ ] second');
  });

  it('removes the last line', async () => {
    const manager = makeManager();
    const repo = new SubtaskLineRepository(manager);

    const task = makeTask('- [ ] alpha\n- [x] beta');
    const result = await repo.remove(task, 1);

    expect(result!.newDesc).toBe('- [ ] alpha');
  });

  it('returns null for out-of-range index', async () => {
    const manager = makeManager();
    const repo = new SubtaskLineRepository(manager);

    const task = makeTask('- [ ] only');
    const result = await repo.remove(task, 5);

    expect(result).toBeNull();
    expect(manager.updateTask).not.toHaveBeenCalled();
  });

  it('returns null for invalid task', async () => {
    const manager = makeManager();
    const repo = new SubtaskLineRepository(manager);

    const result = await repo.remove(null, 0);
    expect(result).toBeNull();
  });
});
