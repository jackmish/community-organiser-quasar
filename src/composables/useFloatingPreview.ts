import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useFloatingPreview(opts?: {
  width?: number;
  shouldIgnoreClick?: (target: Node | null) => boolean;
  /** Called when an outside click dismisses the floating panel (hide, not close/reset). */
  onClickOutside?: () => void;
}) {
  const PREVIEW_WIDTH = opts?.width || 360;
  const previewFloating = ref(false);
  const previewRect = ref<DOMRect | null>(null);
  const preferBelow = ref(false);
  const lastMouseDownTarget = ref<Node | null>(null);
  const lastClosedAt = ref<number | null>(null);
  const CLOSE_IGNORE_MS = 200;
  const focusInsideWrapper = ref(false);

  const handleMouseDown = (e: MouseEvent) => {
    try {
      lastMouseDownTarget.value = e.target as Node | null;
    } catch (err) {
      lastMouseDownTarget.value = null;
    }
  };

  function eventInsideWrapper(e: Event) {
    try {
      const path = (e as any).composedPath ? (e as any).composedPath() : [];
      if (Array.isArray(path) && path.length > 0) {
        for (const n of path) {
          try {
            if (
              n &&
              n instanceof Element &&
              n.matches &&
              n.matches('.floating-preview-wrapper, .fixed-content.floating')
            )
              return true;
          } catch (err) {
            // ignore
          }
        }
      }
      const target = (e as any).target as Node | null;
      if (target instanceof Element) {
        if (target.closest && target.closest('.floating-preview-wrapper, .fixed-content.floating'))
          return true;
      }
    } catch (err) {
      // ignore
    }
    return false;
  }

  function computePreviewStyle(rect: DOMRect | null) {
    if (!rect) return {};
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const preferredWidth = PREVIEW_WIDTH;
    const estimatedHeight = Math.min(600, vh - 64);

    if (preferBelow.value) {
      let left = rect.left;
      let top = rect.bottom + 8;
      if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
      if (top + estimatedHeight + 16 <= vh) {
        return {
          position: 'fixed',
          left: `${Math.round(left)}px`,
          top: `${Math.round(top)}px`,
          width: `${preferredWidth}px`,
          zIndex: 2000,
        } as any;
      }

      left = rect.right + 8;
      top = rect.top;
      if (left + preferredWidth + 16 <= vw) {
        if (top + estimatedHeight + 16 > vh) top = Math.max(8, vh - estimatedHeight - 16);
        return {
          position: 'fixed',
          left: `${Math.round(left)}px`,
          top: `${Math.round(top)}px`,
          width: `${preferredWidth}px`,
          zIndex: 2000,
        } as any;
      }

      left = rect.left - preferredWidth - 8;
      top = rect.top;
      if (left >= 8) {
        if (top + estimatedHeight + 16 > vh) top = Math.max(8, vh - estimatedHeight - 16);
        return {
          position: 'fixed',
          left: `${Math.round(left)}px`,
          top: `${Math.round(top)}px`,
          width: `${preferredWidth}px`,
          zIndex: 2000,
        } as any;
      }

      left = rect.left;
      if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
      top = Math.max(8, rect.top - estimatedHeight - 8);
      return {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    let left = rect.right + 8;
    let top = rect.top;
    if (left + preferredWidth + 16 <= vw) {
      const fullDesiredTop = rect.top - 230;
      let desiredTop = fullDesiredTop;
      if (desiredTop + estimatedHeight + 16 > vh)
        desiredTop = Math.max(8, vh - estimatedHeight - 16);
      if (desiredTop < 8) desiredTop = 8;
      return {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(desiredTop)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    left = rect.left;
    top = rect.bottom + 8;
    if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
    if (top + estimatedHeight + 16 <= vh) {
      return {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    left = rect.left - preferredWidth - 8;
    top = rect.top;
    if (left >= 8) {
      if (top + estimatedHeight + 16 > vh) top = Math.max(8, vh - estimatedHeight - 16);
      return {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    left = rect.left;
    if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
    top = Math.max(8, rect.top - estimatedHeight - 8);
    return {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${preferredWidth}px`,
      zIndex: 2000,
    } as any;
  }

  function setFloating(rect?: DOMRect | null, options?: { forceBelow?: boolean }) {
    try {
      if (lastClosedAt.value && Date.now() - lastClosedAt.value < CLOSE_IGNORE_MS) {
        return;
      }
    } catch (e) {
      void e;
    }
    // Mobile-only guard: keep floating fully disabled in state (not only via CSS),
    // so dependent classes/conditions do not flip unexpectedly on small screens.
    const isMobileViewport = (window.innerWidth || document.documentElement.clientWidth) <= 767;
    const effectiveRect = isMobileViewport ? null : rect ?? null;

    previewRect.value = effectiveRect;
    previewFloating.value = !!effectiveRect;
    preferBelow.value = !!options?.forceBelow;
    if (!previewFloating.value) preferBelow.value = false;
  }

  function resolveRect(target?: any): DOMRect | null {
    try {
      if (!target) return null;
      if (
        typeof target.left === 'number' &&
        typeof target.top === 'number' &&
        typeof target.width === 'number'
      ) {
        return new DOMRect(target.left, target.top, target.width, target.height || 0);
      }
      if (typeof target === 'string') {
        const el = document.querySelector(target);
        if (el instanceof Element) return el.getBoundingClientRect();
        return null;
      }
      if (target instanceof Event) {
        const ct = (target as any).currentTarget as Element | null;
        if (ct && ct.getBoundingClientRect) return ct.getBoundingClientRect();
        const t = (target as any).target as Element | null;
        if (t && t.getBoundingClientRect) return t.getBoundingClientRect();
        return null;
      }
      if (target instanceof Element) {
        if (target.getBoundingClientRect) return target.getBoundingClientRect();
        return null;
      }
      if (typeof target.x === 'number' && typeof target.y === 'number') {
        return new DOMRect(target.x, target.y, target.width || 0, target.height || 0);
      }
      if (typeof target.clientX === 'number' && typeof target.clientY === 'number') {
        return new DOMRect(target.clientX, target.clientY, 0, 0);
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  function anchorTo(target?: any, options?: { forceBelow?: boolean }) {
    const rect = resolveRect(target);
    setFloating(rect, options);
    return rect;
  }

  /** Fully closes the floating preview and stamps lastClosedAt (debounce guard). */
  function closeFloatingPreview() {
    previewFloating.value = false;
    previewRect.value = null;
    preferBelow.value = false;
    try {
      lastClosedAt.value = Date.now();
    } catch (e) {
      void e;
    }
  }

  /**
   * Hides the floating panel without resetting task state or stamping lastClosedAt.
   * Used when clicking outside — the panel collapses to its fixed position but the
   * current task/form is preserved.
   */
  function hideFloating() {
    previewFloating.value = false;
    previewRect.value = null;
    preferBelow.value = false;
  }

  function onFocusIn(e: FocusEvent) {
    try {
      const wrapper =
        document.querySelector('.floating-preview-wrapper') ||
        document.querySelector('.fixed-content.floating');
      const target = e.target as Node | null;
      if (wrapper && target && target instanceof Node && wrapper.contains(target)) {
        focusInsideWrapper.value = true;
      }
    } catch (err) {
      // ignore
    }
  }

  function onFocusOut(e: FocusEvent) {
    try {
      const wrapper =
        document.querySelector('.floating-preview-wrapper') ||
        document.querySelector('.fixed-content.floating');
      const related = (e as any).relatedTarget as Node | null;
      if (wrapper && related && related instanceof Node && wrapper.contains(related)) return;
      focusInsideWrapper.value = false;
    } catch (err) {
      // ignore
    }
  }

  function onDocClick(e: MouseEvent) {
    try {
      try {
        if (focusInsideWrapper.value) return;
      } catch (err) {
        // ignore
      }
      if (eventInsideWrapper(e)) return;

      // Guard: check mousedown target and click target for task elements / action
      // buttons BEFORE querying the wrapper. When no floating preview is visible
      // (wrapper === null), the old code called closeFloatingPreview() immediately,
      // setting lastClosedAt and causing the subsequent setFloating() call from
      // onTaskClicked to be silently blocked by the CLOSE_IGNORE_MS window.
      try {
        const lm = lastMouseDownTarget.value;
        if (lm && lm instanceof Element) {
          const opener = lm.closest('.list-add-btn, .add-task-btn, .floating-add-btn');
          if (opener) {
            lastMouseDownTarget.value = null;
            return;
          }
          const taskOpener = lm.closest('[data-task-id]');
          if (taskOpener) {
            lastMouseDownTarget.value = null;
            return;
          }
        }
        // Also guard on the click target itself in case mousedown fired elsewhere
        const tgt = e.target;
        if (tgt instanceof Element) {
          if (tgt.closest?.('[data-task-id]')) return;
        }
      } catch (err) {
        // ignore
      }

      const getWrapper = () =>
        document.querySelector('.floating-preview-wrapper') ||
        document.querySelector('.fixed-content.floating');
      const wrapper = getWrapper();
      if (!wrapper) {
        hideFloating();
        opts?.onClickOutside?.();
        return;
      }
      const target = e.target;
      if (!target) {
        hideFloating();
        opts?.onClickOutside?.();
        return;
      }
      try {
        const lm = lastMouseDownTarget.value;
        if (lm && lm instanceof Node && wrapper && wrapper.contains(lm)) {
          lastMouseDownTarget.value = null;
          return;
        }
      } catch (err) {
        // ignore
      }
      if (target instanceof Node && wrapper.contains(target)) return;
      try {
        const active = document.activeElement;
        if (active instanceof Node && wrapper.contains(active)) return;
      } catch (err) {
        // ignore
      }
      if (opts?.shouldIgnoreClick && target instanceof Node && opts.shouldIgnoreClick(target))
        return;
      lastMouseDownTarget.value = null;
      hideFloating();
      opts?.onClickOutside?.();
    } catch (err) {
      hideFloating();
      opts?.onClickOutside?.();
    }
  }

  onMounted(() => {
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('mousedown', handleMouseDown, true);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('mousedown', handleMouseDown, true);
  });

  return {
    previewFloating,
    previewRect,
    setFloating,
    closeFloatingPreview,
    hideFloating,
    computePreviewStyle,
    anchorTo,
  } as const;
}
