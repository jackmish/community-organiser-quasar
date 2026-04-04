/**
 * taskListSizeVariant.spec.ts
 *
 * Unit tests for the taskListSizeRanges constant and
 * resolveTaskListSizeVariant helper in theme.ts.
 */

import { describe, it, expect } from 'vitest';
import { taskListSizeRanges, resolveTaskListSizeVariant } from '../../src/components/theme';

describe('taskListSizeRanges', () => {
  it('has the expected thresholds', () => {
    expect(taskListSizeRanges.large).toBe(3);
    expect(taskListSizeRanges.medium).toBe(6);
    expect(taskListSizeRanges.small).toBe(9);
  });
});

describe('resolveTaskListSizeVariant', () => {
  it('returns "large" for 0 tasks', () => {
    expect(resolveTaskListSizeVariant(0)).toBe('large');
  });
  it('returns "large" for exactly 3 tasks', () => {
    expect(resolveTaskListSizeVariant(3)).toBe('large');
  });
  it('returns "medium" for 4 tasks', () => {
    expect(resolveTaskListSizeVariant(4)).toBe('medium');
  });
  it('returns "medium" for exactly 6 tasks', () => {
    expect(resolveTaskListSizeVariant(6)).toBe('medium');
  });
  it('returns "small" for 7 tasks', () => {
    expect(resolveTaskListSizeVariant(7)).toBe('small');
  });
  it('returns "small" for a large number of tasks', () => {
    expect(resolveTaskListSizeVariant(100)).toBe('small');
  });
});
