import { describe, it, expect } from 'vitest';
import { computeTaskNameFromDescription } from '../../src/modules/task/utils/taskNameFromDescription';

describe('computeTaskNameFromDescription', () => {
  it('uses first sentence for plain descriptions', () => {
    expect(
      computeTaskNameFromDescription({
        description: 'Meet Anna at noon. Bring files.',
        eventDate: '2026-07-01',
        type_id: 'TimeEvent',
      }),
    ).toBe('Meet Anna at noon');
  });

  it('builds list-style title from date and type', () => {
    expect(
      computeTaskNameFromDescription({
        description: '- item one',
        eventDate: '2026-07-01',
        type_id: 'TimeEvent',
        timeMode: 'event',
      }),
    ).toMatch(/Event$/);
  });

  it('returns empty for blank description', () => {
    expect(computeTaskNameFromDescription({ description: '   ' })).toBe('');
  });
});
