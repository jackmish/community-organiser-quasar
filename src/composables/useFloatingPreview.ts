import { ref, onMounted, onBeforeUnmount } from "vue";

export function useFloatingPreview(opts?: {
  width?: number;
  shouldIgnoreClick?: (target: Node | null) => boolean;
}) {
  const PREVIEW_WIDTH = opts?.width || 360;
  const previewFloating = ref(false);
  const previewRect = ref<DOMRect | null>(null);
  const preferBelow = ref(false);
  const ignoreNextClickUntil = ref(0);
  const lastMouseDownTarget = ref<Node | null>(null);

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
    // When showing the floating preview, ignore the next global click briefly
    // to avoid the same click (mouse up) immediately closing or resetting it.
    if (previewFloating.value) {
      ignoreNextClickUntil.value = Date.now() + 250;
    } else {
      // clearing floating should also clear preferBelow
      preferBelow.value = false;
      ignoreNextClickUntil.value = 0;
    }
  }

  function closeFloatingPreview() {
    previewFloating.value = false;
    previewRect.value = null;
    preferBelow.value = false;
  }

  function onDocClick(e: MouseEvent) {
    try {
      // Ignore the click that immediately follows opening the preview (same click/up)
      if (Date.now() < ignoreNextClickUntil.value) return;
      // If the mousedown started inside the wrapper (or an ignored element), do not close
      if (lastMouseDownTarget.value) {
        try {
          const wrapper = document.querySelector('.floating-preview-wrapper');
          const t = lastMouseDownTarget.value as Node | null;
          if (wrapper && t && (wrapper.contains(t) || (opts?.shouldIgnoreClick && opts.shouldIgnoreClick(t)))) {
            lastMouseDownTarget.value = null;
            return;
          }
        } catch (err) {
          // ignore
        }
      }
      const wrapper = document.querySelector(".floating-preview-wrapper");
      if (!wrapper) {
        closeFloatingPreview();
        return;
      }
      const target = e.target as Node | null;
      if (!target) {
        closeFloatingPreview();
        return;
      }
      if (wrapper.contains(target)) return;
      if (opts?.shouldIgnoreClick && opts.shouldIgnoreClick(target)) return;
      closeFloatingPreview();
    } catch (err) {
      closeFloatingPreview();
    }
  }

  onMounted(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('mousedown', (e) => {
      try {
        lastMouseDownTarget.value = e.target as Node | null;
      } catch (err) {
        lastMouseDownTarget.value = null;
      }
    });
  });
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('mousedown', (e) => {
      try {
        lastMouseDownTarget.value = e.target as Node | null;
      } catch (err) {
        lastMouseDownTarget.value = null;
      }
    });
  });

  return {
    previewFloating,
    previewRect,
    setFloating,
    closeFloatingPreview,
    computePreviewStyle,
  } as const;
}
