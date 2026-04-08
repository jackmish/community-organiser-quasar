/**
 * taskListSizeVariant.spec.ts
 *
 * Unit tests for the taskListSizeRanges constant and
 * resolveTaskListSizeVariant helper in theme.ts.
 */

import { describe, it, expect } from 'vitest';
import { taskListSizeRanges, resolveTaskListSizeVariant } from '../../src/components/theme';

describe('taskListSizeRanges', () => {
  it('has large < medium < small thresholds', () => {
    expect(taskListSizeRanges.large).toBeLessThan(taskListSizeRanges.medium);
    expect(taskListSizeRanges.medium).toBeLessThan(taskListSizeRanges.small);
  });

  it('all thresholds are positive integers', () => {
    for (const value of Object.values(taskListSizeRanges)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('resolveTaskListSizeVariant', () => {
  it('returns "large" for 0 tasks', () => {
    expect(resolveTaskListSizeVariant(0)).toBe('large');
  });
  it('returns "large" at the large threshold', () => {
    expect(resolveTaskListSizeVariant(taskListSizeRanges.large)).toBe('large');
  });
  it('returns "medium" just above the large threshold', () => {
    expect(resolveTaskListSizeVariant(taskListSizeRanges.large + 1)).toBe('medium');
  });
  it('returns "medium" at the medium threshold', () => {
    expect(resolveTaskListSizeVariant(taskListSizeRanges.medium)).toBe('medium');
  });
  it('returns "small" just above the medium threshold', () => {
    expect(resolveTaskListSizeVariant(taskListSizeRanges.medium + 1)).toBe('small');
  });
  it('returns "small" for a large number of tasks', () => {
    expect(resolveTaskListSizeVariant(taskListSizeRanges.small * 10)).toBe('small');
  });
});
