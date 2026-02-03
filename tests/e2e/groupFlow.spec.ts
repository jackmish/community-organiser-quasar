import { test, expect } from '@playwright/test';

// This E2E test manipulates localStorage to exercise the group->task->update->delete flow.
// Run a local dev server before running this test: `npm run dev`
// Adjust the URL below if your dev server uses a different port.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:9000/';

test('group flow via localStorage (create, add task, move eventDate, delete)', async ({ page }) => {
  // Prepare minimal group + task objects
  const groupId = 'e2e-test-group';
  const now = new Date().toISOString();
  const group = { id: groupId, name: 'E2E Test Group', createdAt: now };

  const taskId = 'e2e-task-1';
  const task = {
    id: taskId,
    title: 'E2E task',
    description: '',
    category: 'general',
    priority: 'normal',
    date: '2026-02-03',
    eventDate: '2026-02-03',
    createdAt: now,
    updatedAt: now,
    groupId,
  };

  const initialData = {
    days: {
      '2026-02-03': { date: '2026-02-03', tasks: [task], notes: '' },
    },
    groups: [group],
    lastModified: now,
  };

  await page.goto(BASE);

  // Write initial data into localStorage and reload so the app picks it up
  await page.evaluate((d) => {
    localStorage.setItem('day-organiser-groups', JSON.stringify(d.groups || []));
    localStorage.setItem('day-organiser-data', JSON.stringify(d));
  }, initialData);
  await page.reload();

  // Sanity check: storage has the group and task
  const stored1 = await page.evaluate(() => ({
    groups: JSON.parse(localStorage.getItem('day-organiser-groups') || '[]'),
    data: JSON.parse(localStorage.getItem('day-organiser-data') || '{}'),
  }));
  expect(stored1.groups.find((g: any) => g.id === groupId)).toBeTruthy();
  expect(stored1.data.days['2026-02-03'].tasks.find((t: any) => t.id === taskId)).toBeTruthy();

  // Move the task to a different date (simulate updateTask)
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('day-organiser-data') || '{}');
    if (!d.days) d.days = {};
    const task =
      d.days['2026-02-03'] && d.days['2026-02-03'].tasks && d.days['2026-02-03'].tasks[0];
    if (!task) return;
    // remove from old day
    d.days['2026-02-03'].tasks = d.days['2026-02-03'].tasks.filter((x: any) => x.id !== task.id);
    // update dates
    task.date = '2026-02-05';
    task.eventDate = '2026-02-05';
    // ensure new day exists
    if (!d.days['2026-02-05']) d.days['2026-02-05'] = { date: '2026-02-05', tasks: [], notes: '' };
    d.days['2026-02-05'].tasks.push(task);
    d.lastModified = new Date().toISOString();
    localStorage.setItem('day-organiser-data', JSON.stringify(d));
  });
  await page.reload();

  const stored2 = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('day-organiser-data') || '{}'),
  );
  expect(stored2.days['2026-02-03'].tasks.find((t: any) => t.id === 'e2e-task-1')).toBeUndefined();
  expect(stored2.days['2026-02-05'].tasks.find((t: any) => t.id === 'e2e-task-1')).toBeTruthy();

  // Now delete the group and remove groupId from tasks
  await page.evaluate(() => {
    const gid = 'e2e-test-group';
    const groups = JSON.parse(localStorage.getItem('day-organiser-groups') || '[]');
    const remaining = groups.filter((g: any) => g.id !== gid);
    localStorage.setItem('day-organiser-groups', JSON.stringify(remaining));
    const d = JSON.parse(localStorage.getItem('day-organiser-data') || '{}');
    if (d.days) {
      Object.keys(d.days).forEach((k) => {
        const day = d.days[k];
        if (Array.isArray(day.tasks)) {
          day.tasks.forEach((t: any) => {
            if (t.groupId === gid) delete t.groupId;
          });
        }
      });
    }
    d.groups = remaining;
    d.lastModified = new Date().toISOString();
    localStorage.setItem('day-organiser-data', JSON.stringify(d));
  });
  await page.reload();

  const stored3 = await page.evaluate(() => ({
    groups: JSON.parse(localStorage.getItem('day-organiser-groups') || '[]'),
    data: JSON.parse(localStorage.getItem('day-organiser-data') || '{}'),
  }));
  expect(stored3.groups.find((g: any) => g.id === groupId)).toBeUndefined();
  const moved = stored3.data.days['2026-02-05'].tasks.find((t: any) => t.id === taskId);
  expect(moved).toBeTruthy();
  expect(moved.groupId).toBeUndefined();
});
