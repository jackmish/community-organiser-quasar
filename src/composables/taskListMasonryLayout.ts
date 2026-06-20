export type MasonryItemMeasure = {
  id: string;
  height: number;
  width: number;
  hasSubtasks: boolean;
  spanAll: boolean;
};

export type MasonryItemPlacement = {
  id: string;
  left: number;
  top: number;
  width?: number;
};

export function computeColumnCount(
  containerWidth: number,
  columnWidth: number,
  gapX: number,
): number {
  return Math.max(1, Math.floor((containerWidth + gapX) / (columnWidth + gapX)));
}

export function computeGridMetrics(
  containerWidth: number,
  columnWidth: number,
  gapX: number,
): {
  cols: number;
  slotWidth: number;
  gridWidth: number;
  offsetX: number;
} {
  const cols = computeColumnCount(containerWidth, columnWidth, gapX);
  const slotWidth = cols === 1 ? Math.min(containerWidth, columnWidth) : columnWidth;
  const gridWidth = cols * slotWidth + (cols - 1) * gapX;
  const offsetX = Math.max(0, (containerWidth - gridWidth) / 2);
  return { cols, slotWidth, gridWidth, offsetX };
}

function columnHeight(colHeights: number[], index: number): number {
  return colHeights[index] ?? 0;
}

function shortestColumnIndex(colHeights: number[]): number {
  let col = 0;
  for (let i = 1; i < colHeights.length; i++) {
    if (columnHeight(colHeights, i) < columnHeight(colHeights, col)) {
      col = i;
    }
  }
  return col;
}

function fillColumnHeights(colHeights: number[], value: number): void {
  for (let i = 0; i < colHeights.length; i++) {
    colHeights[i] = value;
  }
}

/** Pure shortest-column placement used by the task list masonry layout. */
export function buildMasonryPlacements(
  items: MasonryItemMeasure[],
  cols: number,
  slotWidth: number,
  gridWidth: number,
  offsetX: number,
  gapX: number,
  gapY: number,
): { placements: MasonryItemPlacement[]; containerHeight: number } {
  const colHeights = new Array<number>(cols).fill(0);
  const placements: MasonryItemPlacement[] = [];

  for (const item of items) {
    if (item.spanAll) {
      const top = Math.max(...colHeights);
      placements.push({
        id: item.id,
        left: offsetX,
        top,
        width: gridWidth,
      });
      fillColumnHeights(colHeights, top + item.height + gapY);
      continue;
    }

    const col = shortestColumnIndex(colHeights);
    const slotLeft = offsetX + col * (slotWidth + gapX);
    const innerOffset = item.hasSubtasks ? 0 : Math.max(0, (slotWidth - item.width) / 2);
    const top = columnHeight(colHeights, col);

    placements.push({
      id: item.id,
      left: slotLeft + innerOffset,
      top,
      ...(item.hasSubtasks ? { width: slotWidth } : {}),
    });

    colHeights[col] = top + item.height + gapY;
  }

  return {
    placements,
    containerHeight: Math.max(...colHeights, 0),
  };
}
