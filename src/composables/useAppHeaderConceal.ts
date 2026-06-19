import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';

/** Named reasons features use when requesting a concealed app header. */
export const APP_HEADER_CONCEAL_REASON = {
  TODO_SCHEDULE: 'todo-schedule',
  MOBILE_CALENDAR_DAY_INDICATORS: 'mobile-calendar-day-indicators',
} as const;

export type AppHeaderConcealReason =
  (typeof APP_HEADER_CONCEAL_REASON)[keyof typeof APP_HEADER_CONCEAL_REASON];

const activeReasons = ref<ReadonlySet<string>>(new Set());

const concealed = computed(() => activeReasons.value.size > 0);

function syncReasonSet(reason: string, active: boolean): void {
  const next = new Set(activeReasons.value);
  if (active) next.add(reason);
  else next.delete(reason);
  if (next.size === activeReasons.value.size && [...next].every((r) => activeReasons.value.has(r))) {
    return;
  }
  activeReasons.value = next;
  syncDocumentClasses(next);
}

function syncDocumentClasses(reasons: ReadonlySet<string>): void {
  if (typeof document === 'undefined') return;
  try {
    const root = document.documentElement;
    root.classList.toggle('co21-app-header-concealed', reasons.size > 0);
    root.classList.toggle(
      'co21-schedule-mode',
      reasons.has(APP_HEADER_CONCEAL_REASON.TODO_SCHEDULE),
    );
  } catch {
    void 0;
  }
}

watch(activeReasons, syncDocumentClasses, { immediate: true, deep: true });

/** Singleton session: request/release header concealment by reason (stackable). */
export const appHeaderConceal = {
  concealed,
  activeReasons,
  hasReason(reason: string): boolean {
    return activeReasons.value.has(reason);
  },
  syncReason(reason: AppHeaderConcealReason, active: boolean): void {
    syncReasonSet(reason, active);
  },
  request(reason: AppHeaderConcealReason): void {
    syncReasonSet(reason, true);
  },
  release(reason: AppHeaderConcealReason): void {
    syncReasonSet(reason, false);
  },
  releaseAll(): void {
    if (activeReasons.value.size === 0) return;
    activeReasons.value = new Set();
    syncDocumentClasses(activeReasons.value);
  },
};

/** Keep header concealed while `active` is true; releases on scope dispose. */
export function useAppHeaderConcealWhen(
  active: Ref<boolean> | ComputedRef<boolean>,
  reason: AppHeaderConcealReason,
): void {
  watch(
    active,
    (on) => {
      appHeaderConceal.syncReason(reason, on);
    },
    { immediate: true },
  );
}
