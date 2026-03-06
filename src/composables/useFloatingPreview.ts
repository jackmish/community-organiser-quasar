import { ref, onMounted, onBeforeUnmount } from "vue";

export function useFloatingPreview(opts?: {
  width?: number;
  shouldIgnoreClick?: (target: Node | null) => boolean;
}) {
  const PREVIEW_WIDTH = opts?.width || 360;
  const previewFloating = ref(false);
  const previewRect = ref<DOMRect | null>(null);
  const preferBelow = ref(false);
  const lastMouseDownTarget = ref<Node | null>(null);
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
      // Prefer composedPath for shadow/portal-safe detection
      const path = (e as any).composedPath ? (e as any).composedPath() : [];
      if (Array.isArray(path) && path.length > 0) {
        for (const n of path) {
          try {
            if (n && n instanceof Element && n.matches && n.matches('.floating-preview-wrapper, .fixed-content.floating')) return true;
          } catch (err) {
            // ignore per-node errors
          }
        }
      }
      const target = (e as any).target as Node | null;
      if (target instanceof Element) {
        if (target.closest && target.closest('.floating-preview-wrapper, .fixed-content.floating')) return true;
      }
    } catch (err) {
      // ignore
    }
    return false;
  }

  // simplified: rely on mousedown origin and activeElement checks

  function computePreviewStyle(rect: DOMRect | null) {
    if (!rect) return {};
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const preferredWidth = PREVIEW_WIDTH;
    const estimatedHeight = Math.min(600, vh - 64);

    // Two placement modes:
    // - preferBelow: used for task-list items — place below the item first
    // - default: prefer right of the cell (calendar) with the upward offset hack
    if (preferBelow.value) {
      // Below-first: below -> right -> left -> above
      let left = rect.left;
      let top = rect.bottom + 8;
      if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
      if (top + estimatedHeight + 16 <= vh) {
        return {
          position: "fixed",
          left: `${Math.round(left)}px`,
          top: `${Math.round(top)}px`,
          width: `${preferredWidth}px`,
          zIndex: 2000,
        } as any;
      }

      // Try right
      left = rect.right + 8;
      top = rect.top;
      if (left + preferredWidth + 16 <= vw) {
        if (top + estimatedHeight + 16 > vh) top = Math.max(8, vh - estimatedHeight - 16);
        return {
          position: "fixed",
          left: `${Math.round(left)}px`,
          top: `${Math.round(top)}px`,
          width: `${preferredWidth}px`,
          zIndex: 2000,
        } as any;
      }

      // Try left
      left = rect.left - preferredWidth - 8;
      top = rect.top;
      if (left >= 8) {
        if (top + estimatedHeight + 16 > vh) top = Math.max(8, vh - estimatedHeight - 16);
        return {
          position: "fixed",
          left: `${Math.round(left)}px`,
          top: `${Math.round(top)}px`,
          width: `${preferredWidth}px`,
          zIndex: 2000,
        } as any;
      }

      // Above fallback
      left = rect.left;
      if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
      top = Math.max(8, rect.top - estimatedHeight - 8);
      return {
        position: "fixed",
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    // Default: Prefer placing to the right of the cell so the description appears beside it.
    // Fallback order: right -> below -> left -> above.
    // 1) Right
    let left = rect.right + 8;
    let top = rect.top;
    if (left + preferredWidth + 16 <= vw) {
      // start from full upward offset, then clamp using viewport rules so the
      // effective offset decreases automatically when there isn't space below.
      const fullDesiredTop = rect.top - 230;
      let desiredTop = fullDesiredTop;
      // clamp into viewport if needed (same rules used elsewhere)
      if (desiredTop + estimatedHeight + 16 > vh)
        desiredTop = Math.max(8, vh - estimatedHeight - 16);
      if (desiredTop < 8) desiredTop = 8;
      return {
        position: "fixed",
        left: `${Math.round(left)}px`,
        top: `${Math.round(desiredTop)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    // 2) Below
    left = rect.left;
    top = rect.bottom + 8;
    if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
    if (top + estimatedHeight + 16 <= vh) {
      return {
        position: "fixed",
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    // 3) Left
    left = rect.left - preferredWidth - 8;
    top = rect.top;
    if (left >= 8) {
      if (top + estimatedHeight + 16 > vh) top = Math.max(8, vh - estimatedHeight - 16);
      return {
        position: "fixed",
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    // 4) Above (fallback)
    left = rect.left;
    if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
    top = Math.max(8, rect.top - estimatedHeight - 8);
    return {
      position: "fixed",
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${preferredWidth}px`,
      zIndex: 2000,
    } as any;
  }

  function setFloating(rect?: DOMRect | null, options?: { forceBelow?: boolean }) {
    previewRect.value = rect ?? null;
    previewFloating.value = !!rect;
    preferBelow.value = !!options?.forceBelow;
    // No timing protections — rely on mousedown-origin and focus checks
    if (!previewFloating.value) {
      preferBelow.value = false;
    }
  }

  function closeFloatingPreview() {
    previewFloating.value = false;
    previewRect.value = null;
    preferBelow.value = false;
  }

  function onFocusIn(e: FocusEvent) {
    try {
      const wrapper =
        document.querySelector('.floating-preview-wrapper') || document.querySelector('.fixed-content.floating');
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
        document.querySelector('.floating-preview-wrapper') || document.querySelector('.fixed-content.floating');
      const related = (e as any).relatedTarget as Node | null;
      if (wrapper && related && related instanceof Node && wrapper.contains(related)) return;
      focusInsideWrapper.value = false;
    } catch (err) {
      // ignore
    }
  }

  function onDocClick(e: MouseEvent) {
    try {
      // If an element inside the floating wrapper currently has focus (e.g. input via Tab), do not close.
      try {
        if (focusInsideWrapper.value) return;
      } catch (err) {
        // ignore
      }
      // If the click (or its composed event path) is inside the wrapper, ignore.
      if (eventInsideWrapper(e)) return;
      const getWrapper = () =>
        document.querySelector('.floating-preview-wrapper') || document.querySelector('.fixed-content.floating');
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
      // If the event target is inside the floating wrapper, ignore.
      if (target instanceof Node && wrapper.contains(target)) return;
      // If an input inside the wrapper currently has focus (typing), do not close.
      try {
        const active = document.activeElement;
        if (active instanceof Node && wrapper.contains(active)) return;
      } catch (err) {
        // ignore
      }
      if (opts?.shouldIgnoreClick && (target instanceof Node) && opts.shouldIgnoreClick(target)) return;
      // Close and clear any leftover state
      lastMouseDownTarget.value = null;
      closeFloatingPreview();
    } catch (err) {
      closeFloatingPreview();
    }
  }

  onMounted(() => {
    document.addEventListener("click", onDocClick);
    document.addEventListener("mousedown", handleMouseDown);
  });
  onBeforeUnmount(() => {
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("mousedown", handleMouseDown);
  });

  return {
    previewFloating,
    previewRect,
    setFloating,
    closeFloatingPreview,
    computePreviewStyle,
  } as const;

}
