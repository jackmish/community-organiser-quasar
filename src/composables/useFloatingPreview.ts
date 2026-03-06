import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useFloatingPreview(opts?: {
  width?: number;
  shouldIgnoreClick?: (target: Node | null) => boolean;
}) {
  const PREVIEW_WIDTH = opts?.width || 360;
  const previewFloating = ref(false);
  const previewRect = ref<DOMRect | null>(null);

  function computePreviewStyle(rect: DOMRect | null) {
    if (!rect) return {};
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const preferredWidth = PREVIEW_WIDTH;
    const estimatedHeight = Math.min(600, vh - 64);

    // Try placing below first
    let left = rect.left;
    let top = rect.bottom + 8;
    // clamp horizontal if overflowing
    if (left + preferredWidth + 16 > vw) left = Math.max(8, vw - preferredWidth - 16);
    // If fits vertically below, use it
    if (top + estimatedHeight + 16 <= vh) {
      return {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    // Otherwise try placing to the right of the cell
    left = rect.right + 8;
    top = rect.top;
    // If right placement would overflow horizontally, try left side
    if (left + preferredWidth + 16 <= vw) {
      // ensure it fits vertically by clamping top if needed
      if (top + estimatedHeight + 16 > vh) top = Math.max(8, vh - estimatedHeight - 16);
      return {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${preferredWidth}px`,
        zIndex: 2000,
      } as any;
    }

    // Try left side
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

    // Fallback: place above the cell if nothing else fits
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

  function setFloating(rect?: DOMRect | null) {
    previewRect.value = rect ?? null;
    previewFloating.value = !!rect;
  }

  function closeFloatingPreview() {
    previewFloating.value = false;
    previewRect.value = null;
  }

  function onDocClick(e: MouseEvent) {
    try {
      const wrapper = document.querySelector('.floating-preview-wrapper');
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
  });
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick);
  });

  return {
    previewFloating,
    previewRect,
    setFloating,
    closeFloatingPreview,
    computePreviewStyle,
  } as const;
}
