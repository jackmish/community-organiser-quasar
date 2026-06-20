import { describe, expect, it } from 'vitest';
import {
  buildMasonryPlacements,
  computeColumnCount,
  computeGridMetrics,
  type MasonryItemMeasure,
} from '../../src/composables/taskListMasonryLayout';

describe('taskListMasonryLayout', () => {
  it('computes column counts from container width', () => {
    expect(computeColumnCount(360, 400, 10)).toBe(1);
    expect(computeColumnCount(830, 400, 10)).toBe(2);
    expect(computeColumnCount(1240, 400, 10)).toBe(3);
  });

  it('centers the grid within the container', () => {
    const metrics = computeGridMetrics(900, 400, 10);
    expect(metrics.cols).toBe(2);
    expect(metrics.gridWidth).toBe(810);
    expect(metrics.offsetX).toBe(45);
  });

  it('packs items into the shortest column to reduce vertical gaps', () => {
    const items: MasonryItemMeasure[] = [
      { id: 'a', height: 200, width: 180, hasSubtasks: false, spanAll: false },
      { id: 'b', height: 80, width: 160, hasSubtasks: false, spanAll: false },
      { id: 'c', height: 90, width: 170, hasSubtasks: false, spanAll: false },
    ];

    const { placements, containerHeight } = buildMasonryPlacements(
      items,
      2,
      400,
      810,
      0,
      10,
      8,
    );

    expect(placements).toHaveLength(3);
    expect(placements[0]?.top).toBe(0);
    expect(placements[1]?.top).toBe(0);
    expect(placements[2]?.top).toBe(88);
    expect(containerHeight).toBe(208);
  });

  it('places full-width blocks on a new row spanning all columns', () => {
    const items: MasonryItemMeasure[] = [
      { id: 'a', height: 100, width: 180, hasSubtasks: false, spanAll: false },
      { id: 'group', height: 140, width: 810, hasSubtasks: false, spanAll: true },
    ];

    const { placements } = buildMasonryPlacements(items, 2, 400, 810, 5, 10, 8);

    expect(placements[1]?.left).toBe(5);
    expect(placements[1]?.top).toBe(108);
    expect(placements[1]?.width).toBe(810);
  });

  it('uses full slot width for todo cards with subtasks', () => {
    const items: MasonryItemMeasure[] = [
      { id: 'todo', height: 160, width: 400, hasSubtasks: true, spanAll: false },
    ];

    const { placements } = buildMasonryPlacements(items, 2, 400, 810, 0, 10, 8);

    expect(placements[0]?.width).toBe(400);
    expect(placements[0]?.left).toBe(0);
  });
});

describe('task list masonry + floating preview interaction', () => {
  it('shortest-column packing keeps later short cards beside a tall card', () => {
    const items: MasonryItemMeasure[] = [
      { id: 'tall', height: 320, width: 400, hasSubtasks: true, spanAll: false },
      { id: 'event', height: 64, width: 150, hasSubtasks: false, spanAll: false },
      { id: 'event-2', height: 64, width: 140, hasSubtasks: false, spanAll: false },
    ];

    const { placements } = buildMasonryPlacements(items, 3, 400, 1220, 0, 10, 8);

    const tall = placements.find((p) => p.id === 'tall');
    const event = placements.find((p) => p.id === 'event');
    const event2 = placements.find((p) => p.id === 'event-2');

    expect(tall?.left).toBe(0);
    expect(event?.left).toBeGreaterThan(0);
    expect(event2?.left).toBeGreaterThan(0);
    expect(event?.top).toBe(0);
    expect(event2?.top).toBe(0);
    expect(tall?.top).toBe(0);
  });
});
