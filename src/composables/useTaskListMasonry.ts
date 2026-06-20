import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue';

export const TASK_LIST_MASONRY_ITEM_CLASS = 'task-list-masonry-item';

export type TaskListMasonryOptions = {
  columnWidth?: number;
  gapX?: number;
  gapY?: number;
};

type ItemMeasure = {
  item: HTMLElement;
  height: number;
  width: number;
  hasSubtasks: boolean;
  spanAll: boolean;
};

function shouldSpanAllColumns(item: HTMLElement, cols: number): boolean {
  if (cols <= 1) return true;
  return (
    item.querySelector('.replenish-grid') !== null ||
    item.querySelector('.group-task-stack') !== null
  );
}

function resetContainerLayout(container: HTMLElement) {
  container.style.height = '';
}

function resetItemLayout(item: HTMLElement) {
  item.style.position = '';
  item.style.left = '';
  item.style.top = '';
  item.style.width = '';
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

export function useTaskListMasonry(
  containerRef: Ref<HTMLElement | null>,
  layoutTrigger: Ref<unknown>,
  options: TaskListMasonryOptions = {},
) {
  const columnWidth = options.columnWidth ?? 400;
  const gapX = options.gapX ?? 10;
  const gapY = options.gapY ?? 8;

  let resizeObserver: ResizeObserver | null = null;
  let frameId = 0;

  function listItems(container: HTMLElement): HTMLElement[] {
    return Array.from(
      container.querySelectorAll(`:scope > .${TASK_LIST_MASONRY_ITEM_CLASS}`),
    );
  }

  async function layout() {
    await nextTick();
    const container = containerRef.value;
    if (!container) return;

    const items = listItems(container);
    if (!items.length) {
      resetContainerLayout(container);
      return;
    }

    items.forEach(resetItemLayout);
    resetContainerLayout(container);
    container.style.position = 'relative';

    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    const cols = Math.max(1, Math.floor((containerWidth + gapX) / (columnWidth + gapX)));
    const slotWidth = cols === 1 ? Math.min(containerWidth, columnWidth) : columnWidth;
    const gridWidth = cols * slotWidth + (cols - 1) * gapX;
    const offsetX = Math.max(0, (containerWidth - gridWidth) / 2);

    items.forEach((item) => {
      item.style.position = 'absolute';
      item.style.left = '0';
      item.style.top = '0';
      if (item.querySelector('.subtask-chip-list')) {
        item.style.width = `${slotWidth}px`;
      }
    });

    const measurements: ItemMeasure[] = items.map((item) => ({
      item,
      height: item.offsetHeight,
      width: item.offsetWidth,
      hasSubtasks: item.querySelector('.subtask-chip-list') !== null,
      spanAll: shouldSpanAllColumns(item, cols),
    }));

    const colHeights = new Array<number>(cols).fill(0);

    measurements.forEach(({ item, height, width, hasSubtasks, spanAll }) => {
      if (spanAll) {
        const top = Math.max(...colHeights);
        item.style.left = `${offsetX}px`;
        item.style.top = `${top}px`;
        item.style.width = `${gridWidth}px`;
        const bottom = top + height + gapY;
        fillColumnHeights(colHeights, bottom);
        return;
      }

      const col = shortestColumnIndex(colHeights);

      const slotLeft = offsetX + col * (slotWidth + gapX);
      const innerOffset = hasSubtasks ? 0 : Math.max(0, (slotWidth - width) / 2);
      const top = columnHeight(colHeights, col);

      item.style.left = `${slotLeft + innerOffset}px`;
      item.style.top = `${top}px`;
      if (hasSubtasks) {
        item.style.width = `${slotWidth}px`;
      }

      colHeights[col] = top + height + gapY;
    });

    container.style.height = `${Math.max(...colHeights, 0)}px`;
  }

  function scheduleLayout() {
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      void layout();
    });
  }

  function connectObservers() {
    disconnectObservers();
    const container = containerRef.value;
    if (!container) return;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleLayout);
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', scheduleLayout, { passive: true });
  }

  function disconnectObservers() {
    cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    resizeObserver = null;
    window.removeEventListener('resize', scheduleLayout);
  }

  onMounted(() => {
    connectObservers();
    scheduleLayout();
  });

  onBeforeUnmount(disconnectObservers);

  watch(layoutTrigger, scheduleLayout, { deep: true });
  watch(containerRef, (el, prev) => {
    if (prev) resetContainerLayout(prev);
    disconnectObservers();
    if (el) {
      connectObservers();
      scheduleLayout();
    }
  });

  return { scheduleLayout };
}
