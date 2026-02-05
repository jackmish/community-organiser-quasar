import { describe, it, expect } from 'vitest';
import { countTodoSubtasks, countStarredUndone } from '../../src/modules/task/utlils/todo';

describe('todo utils', () => {
  it('counts subtasks and done flags', () => {
    const task = {
      description: `- [ ] first\n- [x] second\n1. [ ] third\n* [✓] fourth`,
    };
    const res = countTodoSubtasks(task);
    expect(res.total).toBe(4);
    expect(res.done).toBe(2);
  });

  it('counts starred but undone items', () => {
    const task = {
      description: `- [ ] a *\n- [x] b *\n- [ ] c`,
    };
    const count = countStarredUndone(task);
    expect(count).toBe(1);
  });
});
