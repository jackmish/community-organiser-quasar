import { describe, it, expect } from 'vitest';
import { countTodoSubtasks, countStarredUndone, parseUndoneSubtasks } from '../../src/modules/task/utils/todo';

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

  it('parses all undone subtask lines', () => {
    const description = `- [ ] buy milk\n- [x] done item\n1. [ ] call Sam\nplain line`;
    expect(parseUndoneSubtasks(description).map((l) => l.text)).toEqual(['buy milk', 'call Sam']);
    expect(parseUndoneSubtasks(description, 1).map((l) => l.text)).toEqual(['buy milk']);
  });
});
