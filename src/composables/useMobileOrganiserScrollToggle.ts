import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue';

export type MobileOrganiserScrollSection = 'day' | 'calendar';

/** Matches `.day-organiser-scroll-anchor { scroll-margin-top }` in day-organiser-page.scss */
const SCROLL_ANCHOR_TOP_PX = 56;
/** Calendar becomes active once its top passes this line (scroll down). */
const CALENDAR_ON_TOP_PX = SCROLL_ANCHOR_TOP_PX + 20;
/** Calendar must drop this far before switching back to tasks (scroll up). */
const CALENDAR_OFF_TOP_PX = SCROLL_ANCHOR_TOP_PX + 72;

function pageScrollHeight(): number {
  return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
}

/**
 * Tracks which Day Organiser section is in view on mobile/tablet and scrolls between
 * the task list and the calendar (including its top quick-jump buttons).
 */
export function useMobileOrganiserScrollToggle(args: {
  enabled: Ref<boolean> | ComputedRef<boolean>;
  daySectionRef: Ref<HTMLElement | null>;
  calendarSectionRef: Ref<HTMLElement | null>;
}) {
  const { enabled, daySectionRef, calendarSectionRef } = args;

  /** Which section dominates the viewport — drives toggle label/icon. */
  const visibleSection = ref<MobileOrganiserScrollSection>('day');
  const hasVerticalPageScroll = ref(false);

  const showScrollToggle = computed(() => enabled.value && hasVerticalPageScroll.value);

  const scrollToggleIcon = computed(() =>
    visibleSection.value === 'calendar' ? 'view_agenda' : 'calendar_month',
  );

  /** Label names the destination (where the button scrolls to). */
  const scrollToggleLabelKey = computed(() =>
    visibleSection.value === 'calendar' ? 'func.tasks' : 'ui.calendar_view',
  );

  let scrollRaf: number | null = null;
  let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  let ignoreScrollUntil = 0;
  let resizeObserver: ResizeObserver | null = null;

  function updateVerticalScrollAvailability(): void {
    hasVerticalPageScroll.value = pageScrollHeight() > window.innerHeight + 8;
  }

  function measureVisibleSection(current: MobileOrganiserScrollSection): MobileOrganiserScrollSection {
    const dayEl = daySectionRef.value;
    const calEl = calendarSectionRef.value;
    if (!dayEl || !calEl) return current;

    const calTop = calEl.getBoundingClientRect().top;

    // Hysteresis: different thresholds for entering vs leaving calendar view.
    if (current === 'day') {
      return calTop <= CALENDAR_ON_TOP_PX ? 'calendar' : 'day';
    }
    return calTop >= CALENDAR_OFF_TOP_PX ? 'day' : 'calendar';
  }

  function applyMeasuredSection(): void {
    if (!hasVerticalPageScroll.value) {
      visibleSection.value = 'day';
      return;
    }
    const next = measureVisibleSection(visibleSection.value);
    if (next !== visibleSection.value) {
      visibleSection.value = next;
    }
  }

  function isMainPageScrollTarget(target: EventTarget | null): boolean {
    if (target === document || target === document.documentElement) return true;
    if (!(target instanceof HTMLElement)) return false;
    return (
      target === document.body ||
      target.classList.contains('q-page-container') ||
      target.classList.contains('q-page') ||
      target.classList.contains('co21-main-layout')
    );
  }

  function onScroll(event: Event): void {
    if (!hasVerticalPageScroll.value) return;
    if (!isMainPageScrollTarget(event.target)) return;
    if (Date.now() < ignoreScrollUntil) return;

    if (scrollEndTimer) clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(() => {
      applyMeasuredSection();
      scrollEndTimer = null;
    }, 120);

    if (scrollRaf !== null) return;
    scrollRaf = requestAnimationFrame(() => {
      applyMeasuredSection();
      scrollRaf = null;
    });
  }

  function onLayoutChange(): void {
    updateVerticalScrollAvailability();
    applyMeasuredSection();
  }

  function scrollToSection(el: HTMLElement | null): void {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onScrollToggleClick(): void {
    const goingToDay = visibleSection.value === 'calendar';
    visibleSection.value = goingToDay ? 'day' : 'calendar';
    ignoreScrollUntil = Date.now() + 900;
    scrollToSection(goingToDay ? daySectionRef.value : calendarSectionRef.value);
  }

  function disconnectResizeObserver(): void {
    try {
      resizeObserver?.disconnect();
    } catch (e) {
      void e;
    }
    resizeObserver = null;
  }

  function connectResizeObserver(): void {
    disconnectResizeObserver();
    if (typeof ResizeObserver === 'undefined') return;

    resizeObserver = new ResizeObserver(() => onLayoutChange());
    const dayEl = daySectionRef.value;
    const calEl = calendarSectionRef.value;
    if (dayEl) resizeObserver.observe(dayEl);
    if (calEl) resizeObserver.observe(calEl);
    resizeObserver.observe(document.body);
  }

  function connectTracking(): void {
    disconnectTracking();
    onLayoutChange();
    connectResizeObserver();
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onLayoutChange, { passive: true });
  }

  function disconnectTracking(): void {
    document.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('resize', onLayoutChange);
    disconnectResizeObserver();
    if (scrollRaf !== null) {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = null;
    }
    if (scrollEndTimer) {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = null;
    }
    ignoreScrollUntil = 0;
  }

  watch(
    enabled,
    (on) => {
      if (on) {
        void nextTick(() => connectTracking());
      } else {
        disconnectTracking();
        hasVerticalPageScroll.value = false;
        visibleSection.value = 'day';
      }
    },
    { immediate: true },
  );

  watch([daySectionRef, calendarSectionRef], () => {
    if (!enabled.value) return;
    void nextTick(() => {
      connectResizeObserver();
      onLayoutChange();
    });
  });

  onBeforeUnmount(() => {
    disconnectTracking();
  });

  return {
    visibleSection,
    showScrollToggle,
    scrollToggleIcon,
    scrollToggleLabelKey,
    onScrollToggleClick,
  } as const;
}
