import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';

/** Matches q-page.q-pa-md bottom padding. */
const PAGE_PADDING_BOTTOM_PX = 16;
/** Row gap above preview (`q-mt-md`). Used only for anchor fallback before preview mounts. */
const PREVIEW_ROW_MARGIN_TOP_PX = 16;

/**
 * Sizes the inline Files-mode preview row to exactly the viewport space below the task list.
 */
export function useMediaFilesPreviewLayout(args: {
  enabled: Ref<boolean>;
  listAnchorRef: Ref<HTMLElement | null>;
  previewSectionRef: Ref<HTMLElement | null>;
}) {
  const previewHeight = ref<number | null>(null);

  let listObserver: ResizeObserver | null = null;
  let previewObserver: ResizeObserver | null = null;

  function measure(): void {
    if (!args.enabled.value) {
      previewHeight.value = null;
      return;
    }

    const previewEl = args.previewSectionRef.value;
    if (previewEl) {
      const top = previewEl.getBoundingClientRect().top;
      const available = window.innerHeight - top - PAGE_PADDING_BOTTOM_PX;
      previewHeight.value = Math.max(0, Math.floor(available));
      return;
    }

    const anchor = args.listAnchorRef.value;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const available =
      window.innerHeight -
      rect.bottom -
      PREVIEW_ROW_MARGIN_TOP_PX -
      PAGE_PADDING_BOTTOM_PX;
    previewHeight.value = Math.max(0, Math.floor(available));
  }

  function disconnect(): void {
    window.removeEventListener('resize', measure);
    window.removeEventListener('scroll', measure, true);
    listObserver?.disconnect();
    previewObserver?.disconnect();
    listObserver = null;
    previewObserver = null;
  }

  function connect(): void {
    disconnect();
    measure();
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true, capture: true });

    if (typeof ResizeObserver !== 'undefined') {
      const anchor = args.listAnchorRef.value;
      if (anchor) {
        listObserver = new ResizeObserver(() => measure());
        listObserver.observe(anchor);
      }
      const previewEl = args.previewSectionRef.value;
      if (previewEl) {
        previewObserver = new ResizeObserver(() => measure());
        previewObserver.observe(previewEl);
      }
    }
  }

  watch(
    () =>
      [args.enabled.value, args.listAnchorRef.value, args.previewSectionRef.value] as const,
    ([enabled]) => {
      disconnect();
      if (!enabled) {
        previewHeight.value = null;
        return;
      }
      void nextTick(() => {
        measure();
        connect();
      });
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    disconnect();
  });

  const previewSectionStyle = computed<Record<string, string>>(() => {
    const height = previewHeight.value;
    if (height == null || height <= 0) return {};
    return {
      height: `${height}px`,
      maxHeight: `${height}px`,
      overflow: 'hidden',
    };
  });

  return { previewHeight, previewSectionStyle };
}
