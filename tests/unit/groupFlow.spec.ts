import { describe, it, expect, beforeEach } from 'vitest';
import { addGroup, deleteGroup } from '../../src/modules/group/groupService';
import { addTask, updateTask } from '../../src/modules/task/taskService';

let data: any;

beforeEach(() => {
  data = { days: {}, groups: [] };
});

describe('group -> task -> update -> delete flow', () => {
  it('creates a group, adds task with date, updates eventDate, then deletes the group', () => {
    const group = addGroup(data, { name: 'Test Group', color: '#ff0000' });
    expect(group).toBeTruthy();
    expect(data.groups.find((g: any) => g.id === group.id)).toBeTruthy();

    const task = addTask(data, '2026-02-03', {
      title: 'Task in group',
      category: 'general',
      priority: 'normal',
      description: '',
      groupId: group.id,
    });

    expect(task).toBeTruthy();
    expect(data.days['2026-02-03'].tasks.find((t: any) => t.id === task.id)).toBeTruthy();

    // Update eventDate (move to new day)
    updateTask(data, '2026-02-03', task.id, { eventDate: '2026-02-05', date: '2026-02-05' });

    expect(data.days['2026-02-03'].tasks.find((t: any) => t.id === task.id)).toBeUndefined();
    expect(data.days['2026-02-05'].tasks.find((t: any) => t.id === task.id)).toBeTruthy();

    // Now delete the group
    const res = deleteGroup(data, group.id);
    expect(res).toBeTruthy();
    // group removed
    expect(data.groups.find((g: any) => g.id === group.id)).toBeUndefined();
    // task should have groupId removed
    const movedTask = data.days['2026-02-05'].tasks.find((t: any) => t.id === task.id);
    expect(movedTask).toBeTruthy();
    expect(movedTask.groupId).toBeUndefined();
  });
});
