/**
 * useFloatingPreview.spec.ts
 *
 * Unit tests for the useFloatingPreview composable, specifically the
 * onDocClick handler that was causing the floating task-preview to never
 * open when a task card was clicked while no preview wrapper was visible.
 *
 * Root-cause of the bug:
 *   When no `.floating-preview-wrapper` / `.fixed-content.floating` element
 *   was in the DOM (e.g. the panel was in 'add' mode), onDocClick hit the
 *   early `if (!wrapper) { closeFloatingPreview(); return; }` branch on every
 *   click – including clicks on task cards.  That set `lastClosedAt` to the
 *   current timestamp, and the subsequent `setFloating(rect)` call from
 *   `onTaskClicked` (after nextTick + rAF) was silently blocked by the
 *   200 ms CLOSE_IGNORE_MS guard.
 *
 * The fix moves the `[data-task-id]` / opener-button guard BEFORE the
 * wrapper-null check so that task-card clicks are never misidentified as
 * "outside" clicks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, nextTick } from 'vue';
import { useFloatingPreview } from '../../src/composables/useFloatingPreview';

/** jsdom may not expose DOMRect as a constructor; use a plain duck-typed object. */
const makeRect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as unknown as DOMRect;

// ── helpers ──────────────────────────────────────────────────────────────────

/** Mount a composable inside a real (but minimal) Vue app so that onMounted /
 *  onBeforeUnmount lifecycle hooks run and DOM event listeners are registered. */
function withSetup<T>(fn: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = fn();
        return {};
      },
      render: () => null as any,
    }),
  );
  const el = document.createElement('div');
  document.body.appendChild(el);
  app.mount(el);
  return {
    result,
    unmount: () => {
      app.unmount();
      if (el.parentNode) el.parentNode.removeChild(el);
    },
  };
}

/** Fire mousedown then click on `target`, replicating normal browser behavior.
 *  The capture-phase listener on document (handleMouseDown) records the
 *  mousedown target before onDocClick inspects it. */
function simulateClick(target: Element) {
  target.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }),
  );
  target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
  );
}

// ── test suite ────────────────────────────────────────────────────────────────

describe('useFloatingPreview', () => {
  let taskEl: HTMLElement;
  let outsideEl: HTMLElement;

  beforeEach(() => {
    // Task card element – the kind that exists in the real task list
    taskEl = document.createElement('div');
    taskEl.setAttribute('data-task-id', 'task-abc');
    document.body.appendChild(taskEl);

    // Generic element that is NOT a task card or action button
    outsideEl = document.createElement('div');
    outsideEl.id = 'outside-element';
    document.body.appendChild(outsideEl);
  });

  afterEach(() => {
    taskEl.remove();
    outsideEl.remove();
  });

  // ── basic setFloating behaviour ────────────────────────────────────────────

  it('setFloating(rect) opens the preview', () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      const rect = makeRect(100, 100, 200, 40);
      result.setFloating(rect);
      expect(result.previewFloating.value).toBe(true);
      expect(result.previewRect.value).toStrictEqual(rect);
    } finally {
      unmount();
    }
  });

  it('setFloating(null) closes the preview', () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      result.setFloating(makeRect(100, 100, 200, 40));
      result.setFloating(null);
      expect(result.previewFloating.value).toBe(false);
      expect(result.previewRect.value).toBeNull();
    } finally {
      unmount();
    }
  });

  it('closeFloatingPreview() resets all state', () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      result.setFloating(makeRect(100, 100, 200, 40));
      result.closeFloatingPreview();
      expect(result.previewFloating.value).toBe(false);
      expect(result.previewRect.value).toBeNull();
    } finally {
      unmount();
    }
  });

  it('anchorTo(element) opens preview using the element bounding rect', () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      // jsdom getBoundingClientRect returns a zero rect. anchorTo should pass
      // that rect to setFloating — the result is an object (not null).
      const r = result.anchorTo(taskEl);
      expect(r).not.toBeNull();
      // previewFloating is true because a truthy rect object was resolved
      expect(result.previewFloating.value).toBe(true);
    } finally {
      unmount();
    }
  });

  // ── outside-click closes logic is preserved ────────────────────────────────

  it('clicking an unrelated element (no wrapper in DOM) hides the preview WITHOUT blocking subsequent setFloating', async () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      result.setFloating(makeRect(100, 100, 200, 40));
      expect(result.previewFloating.value).toBe(true);

      // Click outside – no data-task-id, no wrapper in DOM
      simulateClick(outsideEl);
      await nextTick();

      // Preview is hidden (collapsed, not reset)
      expect(result.previewFloating.value).toBe(false);

      // hideFloating does NOT stamp lastClosedAt, so setFloating succeeds immediately
      result.setFloating(makeRect(100, 100, 200, 40));
      expect(result.previewFloating.value).toBe(true);
    } finally {
      unmount();
    }
  });

  // ── THE BUG: task-card click when no wrapper visible must not block setFloating ─

  it('[BUG FIX] clicking a [data-task-id] element while no floating wrapper is in the DOM does NOT set lastClosedAt', async () => {
    // Scenario: user opens the app, panel is in "add" mode, no floating preview.
    // .floating-preview-wrapper and .fixed-content.floating are absent from DOM.
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      expect(result.previewFloating.value).toBe(false);

      // Simulate the click on a task card
      simulateClick(taskEl);
      await nextTick();

      // onDocClick must NOT have called closeFloatingPreview() – so the 200 ms
      // window must NOT be active, and setFloating should succeed immediately.
      const rect = makeRect(50, 200, 160, 44);
      result.setFloating(rect);

      expect(result.previewFloating.value).toBe(true);
      expect(result.previewRect.value).toStrictEqual(rect);
    } finally {
      unmount();
    }
  });

  it('[BUG FIX] repeated task-card clicks keep setFloating unblocked each time', async () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      for (let i = 0; i < 3; i++) {
        result.setFloating(null); // reset
        simulateClick(taskEl);
        await nextTick();

        const rect = makeRect(10 * i, 100, 150, 40);
        result.setFloating(rect);
        expect(result.previewFloating.value).toBe(true);
      }
    } finally {
      unmount();
    }
  });

  it('[BUG FIX] clicking a task element when a preview IS already open keeps setFloating unblocked', async () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      // Open preview first
      result.setFloating(makeRect(100, 100, 200, 40));
      expect(result.previewFloating.value).toBe(true);

      // Click on a DIFFERENT task card (wrapper not in DOM in unit test context)
      simulateClick(taskEl);
      await nextTick();

      const rect = makeRect(50, 200, 160, 44);
      result.setFloating(rect);
      expect(result.previewFloating.value).toBe(true);
      expect(result.previewRect.value).toStrictEqual(rect);
    } finally {
      unmount();
    }
  });

  it('shouldIgnoreClick callback prevents closeFloatingPreview when it returns true', async () => {
    const { result, unmount } = withSetup(() =>
      useFloatingPreview({ shouldIgnoreClick: () => true }),
    );
    try {
      result.setFloating(makeRect(100, 100, 200, 40));

      // Click outside (no data-task-id, no wrapper) but shouldIgnoreClick=true
      // Note: shouldIgnoreClick only runs when a wrapper IS found; the test
      // verifies the outside-el click path with a wrapper present.
      const wrapperEl = document.createElement('div');
      wrapperEl.className = 'floating-preview-wrapper';
      document.body.appendChild(wrapperEl);
      try {
        simulateClick(outsideEl);
        await nextTick();
        // shouldIgnoreClick returns true → preview should remain open
        expect(result.previewFloating.value).toBe(true);
      } finally {
        wrapperEl.remove();
      }
    } finally {
      unmount();
    }
  });

  // ── hideFloating + onClickOutside (hide-not-reset behaviour) ─────────────────────

  it('hideFloating() collapses the panel WITHOUT stamping lastClosedAt — setFloating succeeds immediately after', () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      result.setFloating(makeRect(100, 100, 200, 40));
      expect(result.previewFloating.value).toBe(true);

      result.hideFloating();
      expect(result.previewFloating.value).toBe(false);
      expect(result.previewRect.value).toBeNull();

      // Unlike closeFloatingPreview(), the 200 ms guard is NOT active
      const rect = makeRect(50, 50, 100, 30);
      result.setFloating(rect);
      expect(result.previewFloating.value).toBe(true);
      expect(result.previewRect.value).toStrictEqual(rect);
    } finally {
      unmount();
    }
  });

  it('closeFloatingPreview() stamps lastClosedAt and blocks immediate setFloating', () => {
    const { result, unmount } = withSetup(() => useFloatingPreview());
    try {
      result.setFloating(makeRect(100, 100, 200, 40));
      result.closeFloatingPreview();
      expect(result.previewFloating.value).toBe(false);

      // Immediate setFloating is blocked by the 200 ms CLOSE_IGNORE_MS guard
      result.setFloating(makeRect(50, 50, 100, 30));
      expect(result.previewFloating.value).toBe(false);
    } finally {
      unmount();
    }
  });

  it('onClickOutside callback fires when clicking an unrelated element (no floating wrapper in DOM)', async () => {
    const onClickOutside = vi.fn();
    const { result, unmount } = withSetup(() => useFloatingPreview({ onClickOutside }));
    try {
      result.setFloating(makeRect(100, 100, 200, 40));
      simulateClick(outsideEl);
      await nextTick();
      // callback fired — caller (e.g. page) can set panelHidden=true to slide away
      expect(onClickOutside).toHaveBeenCalledOnce();
      // panel hidden (floating gone), no lastClosedAt stamp
      expect(result.previewFloating.value).toBe(false);
      result.setFloating(makeRect(10, 10, 50, 50));
      expect(result.previewFloating.value).toBe(true);
    } finally {
      unmount();
    }
  });

  it('onClickOutside callback fires when clicking outside a visible wrapper', async () => {
    const onClickOutside = vi.fn();
    const { result, unmount } = withSetup(() => useFloatingPreview({ onClickOutside }));
    try {
      result.setFloating(makeRect(100, 100, 200, 40));
      const wrapperEl = document.createElement('div');
      wrapperEl.className = 'floating-preview-wrapper';
      document.body.appendChild(wrapperEl);
      try {
        simulateClick(outsideEl);
        await nextTick();
        expect(onClickOutside).toHaveBeenCalledOnce();
        expect(result.previewFloating.value).toBe(false);
        // setFloating succeeds immediately (hideFloating, not closeFloatingPreview)
        result.setFloating(makeRect(10, 10, 50, 50));
        expect(result.previewFloating.value).toBe(true);
      } finally {
        wrapperEl.remove();
      }
    } finally {
      unmount();
    }
  });

  it('onClickOutside callback does NOT fire when clicking a [data-task-id] element', async () => {
    const onClickOutside = vi.fn();
    const { result, unmount } = withSetup(() => useFloatingPreview({ onClickOutside }));
    try {
      simulateClick(taskEl);
      await nextTick();
      expect(onClickOutside).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });
});
