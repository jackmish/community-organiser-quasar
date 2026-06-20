import { describe, expect, it } from 'vitest';

function columnCount(containerWidth: number, columnWidth: number, gapX: number): number {
  return Math.max(1, Math.floor((containerWidth + gapX) / (columnWidth + gapX)));
}

function gridWidth(cols: number, slotWidth: number, gapX: number): number {
  return cols * slotWidth + (cols - 1) * gapX;
}

describe('task list masonry column math', () => {
  it('fits one column on narrow containers', () => {
    expect(columnCount(360, 400, 10)).toBe(1);
  });

  it('fits multiple 400px columns with gaps', () => {
    expect(columnCount(830, 400, 10)).toBe(2);
    expect(columnCount(1240, 400, 10)).toBe(3);
    expect(gridWidth(2, 400, 10)).toBe(810);
  });
});
