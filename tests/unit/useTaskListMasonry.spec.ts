/**
 * Guards against masonry relayout breaking floating task preview anchoring.
 *
 * Regression: layout() temporarily stacked every card at (0,0) while measuring,
 * so a task click + preview open during that window got a wrong bounding rect.
 * Layout now measures in normal flow first; selection changes no longer relayout.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, nextTick, ref } from 'vue';
import { useTaskListMasonry, TASK_LIST_MASONRY_ITEM_CLASS } from '../../src/composables/useTaskListMasonry';

function mountMasonry(onLayoutComplete?: () => void) {
  const containerRef = ref<HTMLElement | null>(null);
  const trigger = ref(0);

  const app = createApp(
    defineComponent({
      setup() {
        useTaskListMasonry(containerRef, trigger, {
          columnWidth: 400,
          gapX: 10,
          gapY: 8,
          onLayoutComplete,
        });
        return { containerRef };
      },
      template: '<div ref="containerRef" class="task-list"></div>',
    }),
  );

  const host = document.createElement('div');
  document.body.appendChild(host);
  app.mount(host);

  const container = host.querySelector('.task-list') as HTMLElement;
  containerRef.value = container;
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 900 });

  return {
    container,
    trigger,
    unmount: () => {
      app.unmount();
      host.remove();
    },
  };
}

function addMasonryItem(container: HTMLElement, id: string, height: number, width: number) {
  const item = document.createElement('div');
  item.className = TASK_LIST_MASONRY_ITEM_CLASS;
  item.dataset.taskId = id;
  item.style.height = `${height}px`;
  item.style.width = `${width}px`;
  container.appendChild(item);
  return item;
}

describe('useTaskListMasonry preview anchoring', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not stack all items at (0,0) while measuring', async () => {
    const { container, trigger, unmount } = mountMasonry();
    try {
      addMasonryItem(container, 'a', 120, 180);
      addMasonryItem(container, 'b', 90, 160);
      trigger.value += 1;
      await nextTick();
      await nextTick();

      const items = [...container.querySelectorAll(`.${TASK_LIST_MASONRY_ITEM_CLASS}`)] as HTMLElement[];
      expect(items).toHaveLength(2);

      const tops = items.map((el) => parseFloat(el.style.top || '0'));
      const lefts = items.map((el) => parseFloat(el.style.left || '0'));

      expect(lefts[0]).not.toBe(lefts[1]);
      const stackedAtOrigin = items.filter(
        (el) => el.style.left === '0px' && el.style.top === '0px',
      );
      expect(stackedAtOrigin.length).toBeLessThan(items.length);
      expect(items.every((el) => el.style.position === 'absolute')).toBe(true);
    } finally {
      unmount();
    }
  });

  it('preserves distinct bounding rects for task cards after layout', async () => {
    const { container, trigger, unmount } = mountMasonry();
    try {
      const first = addMasonryItem(container, 'task-1', 140, 200);
      first.setAttribute('data-task-id', 'task-1');
      const second = addMasonryItem(container, 'task-2', 100, 180);
      second.setAttribute('data-task-id', 'task-2');

      trigger.value += 1;
      await nextTick();
      await nextTick();

      const left1 = parseFloat(first.style.left || '0');
      const left2 = parseFloat(second.style.left || '0');

      expect(left1).not.toBe(left2);
    } finally {
      unmount();
    }
  });

  it('calls onLayoutComplete after repositioning items', async () => {
    const onLayoutComplete = vi.fn();
    const { container, trigger, unmount } = mountMasonry(onLayoutComplete);
    try {
      addMasonryItem(container, 'a', 100, 180);
      trigger.value += 1;
      await nextTick();
      await nextTick();
      expect(onLayoutComplete).toHaveBeenCalled();
    } finally {
      unmount();
    }
  });
});
