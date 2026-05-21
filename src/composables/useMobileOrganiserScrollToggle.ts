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

/**
 * Tracks which Day Organiser section is in view on mobile and scrolls between
 * the task list header and the calendar (including its top quick-jump buttons).
 */
export function useMobileOrganiserScrollToggle(args: {
  enabled: Ref<boolean> | ComputedRef<boolean>;
  daySectionRef: Ref<HTMLElement | null>;
  calendarSectionRef: Ref<HTMLElement | null>;
}) {
  const { enabled, daySectionRef, calendarSectionRef } = args;

  /** Which section dominates the viewport — drives toggle label/icon. */
  const visibleSection = ref<MobileOrganiserScrollSection>('day');

  const scrollToggleIcon = computed(() =>
    visibleSection.value === 'calendar' ? 'view_agenda' : 'calendar_month',
  );

  /** Label names the destination (where the button scrolls to). */
  const scrollToggleLabelKey = computed(() =>
    visibleSection.value === 'calendar' ? 'ui.day_view' : 'ui.calendar_view',
  );

  let observer: IntersectionObserver | null = null;
  let ratios = { day: 0, calendar: 0 };

  function updateVisibleSection() {
    const { day, calendar } = ratios;
    if (calendar > day + 0.05) {
      visibleSection.value = 'calendar';
    } else if (day > calendar + 0.05) {
      visibleSection.value = 'day';
    }
  }

  function scrollToSection(el: HTMLElement | null) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onScrollToggleClick() {
    if (visibleSection.value === 'calendar') {
      scrollToSection(daySectionRef.value);
    } else {
      scrollToSection(calendarSectionRef.value);
    }
  }

  function disconnectObserver() {
    try {
      observer?.disconnect();
    } catch (e) {
      void e;
    }
    observer = null;
    ratios = { day: 0, calendar: 0 };
  }

  function connectObserver() {
    disconnectObserver();
    const dayEl = daySectionRef.value;
    const calEl = calendarSectionRef.value;
    if (!dayEl || !calEl) return;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === dayEl) ratios.day = entry.intersectionRatio;
          if (entry.target === calEl) ratios.calendar = entry.intersectionRatio;
        }
        updateVisibleSection();
      },
      { root: null, threshold: [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 1] },
    );

    observer.observe(dayEl);
    observer.observe(calEl);
    updateVisibleSection();
  }

  watch(
    enabled,
    (on) => {
      if (on) {
        void nextTick(() => connectObserver());
      } else {
        disconnectObserver();
        visibleSection.value = 'day';
      }
    },
    { immediate: true },
  );

  watch([daySectionRef, calendarSectionRef], () => {
    if (enabled.value) void nextTick(() => connectObserver());
  });

  onBeforeUnmount(() => {
    disconnectObserver();
  });

  return {
    visibleSection,
    scrollToggleIcon,
    scrollToggleLabelKey,
    onScrollToggleClick,
  } as const;
}
