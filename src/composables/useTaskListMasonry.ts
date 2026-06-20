import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import {
  buildMasonryPlacements,
  computeGridMetrics,
  type MasonryItemMeasure,
} from './taskListMasonryLayout';

export const TASK_LIST_MASONRY_ITEM_CLASS = 'task-list-masonry-item';

export type TaskListMasonryOptions = {
  columnWidth?: number;
  gapX?: number;
  gapY?: number;
  /** Fired after items are repositioned (e.g. re-anchor floating task preview). */
  onLayoutComplete?: () => void;
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

function masonryItemId(item: HTMLElement, index: number): string {
  return item.dataset.masonryId || `masonry-item-${index}`;
}

function measureItems(
  items: HTMLElement[],
  cols: number,
  slotWidth: number,
): MasonryItemMeasure[] {
  return items.map((item, index) => ({
    id: masonryItemId(item, index),
    height: item.offsetHeight,
    width: item.offsetWidth,
    hasSubtasks: item.querySelector('.subtask-chip-list') !== null,
    spanAll: shouldSpanAllColumns(item, cols),
  }));
}

function applyPlacements(
  items: HTMLElement[],
  measures: MasonryItemMeasure[],
  placements: ReturnType<typeof buildMasonryPlacements>['placements'],
): void {
  const byId = new Map(measures.map((m, index) => [m.id, items[index] as HTMLElement]));

  for (const placement of placements) {
    const item = byId.get(placement.id);
    if (!item) continue;
    item.style.position = 'absolute';
    item.style.left = `${placement.left}px`;
    item.style.top = `${placement.top}px`;
    if (placement.width != null) {
      item.style.width = `${placement.width}px`;
    } else {
      item.style.width = '';
    }
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
    items.forEach((item, index) => {
      item.dataset.masonryId = masonryItemId(item, index);
    });

    if (!items.length) {
      resetContainerLayout(container);
      options.onLayoutComplete?.();
      return;
    }

    // Measure in normal flow before applying absolute positions so task-card
    // bounding rects stay valid for floating preview anchoring.
    items.forEach(resetItemLayout);
    resetContainerLayout(container);
    container.style.position = 'relative';

    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    const { cols, slotWidth, gridWidth, offsetX } = computeGridMetrics(
      containerWidth,
      columnWidth,
      gapX,
    );

    const measures = measureItems(items, cols, slotWidth);
    const { placements, containerHeight } = buildMasonryPlacements(
      measures,
      cols,
      slotWidth,
      gridWidth,
      offsetX,
      gapX,
      gapY,
    );

    applyPlacements(items, measures, placements);
    container.style.height = `${containerHeight}px`;
    options.onLayoutComplete?.();
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
