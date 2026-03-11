import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useFloatingPreview(opts?: {
  width?: number;
  shouldIgnoreClick?: (target: Node | null) => boolean;
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
    previewRect.value = rect ?? null;
    previewFloating.value = !!rect;
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
      const getWrapper = () =>
        document.querySelector('.floating-preview-wrapper') ||
        document.querySelector('.fixed-content.floating');
      const wrapper = getWrapper();
      if (!wrapper) {
        closeFloatingPreview();
        return;
      }
      const target = e.target;
      if (!target) {
        closeFloatingPreview();
        return;
      }
      try {
        const lm = lastMouseDownTarget.value;
        if (lm && lm instanceof Node && wrapper && wrapper.contains(lm)) {
          lastMouseDownTarget.value = null;
          return;
        }
        try {
          if (lm && lm instanceof Element) {
            const opener = lm.closest('.list-add-btn, .add-task-btn, .floating-add-btn');
            if (opener) {
              lastMouseDownTarget.value = null;
              return;
            }
            const taskOpener = lm.closest && lm.closest('[data-task-id]');
            if (taskOpener) {
              lastMouseDownTarget.value = null;
              return;
            }
          }
        } catch (err) {
          // ignore
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
      closeFloatingPreview();
    } catch (err) {
      closeFloatingPreview();
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
    computePreviewStyle,
    anchorTo,
  } as const;
}
