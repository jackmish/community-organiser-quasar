import { onMounted, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import { todayString } from 'src/utils/dateUtils';

/**
 * Registers a 60-second interval that advances `currentDate` to today whenever
 * the stored date falls behind the system clock (e.g. after midnight).
 *
 * Also advances immediately on mount if the stored date is already stale.
 *
 * Safe to call inside any Vue setup() / <script setup>.
 */
export function useDayRollover(args: {
  currentDate: Ref<string>;
  setCurrentDate: (d: string) => void;
}) {
  const { currentDate, setCurrentDate } = args;

  function rolloverIfStale() {
    try {
      const today = todayString();
      const cur = String(currentDate.value || '');
      if (!cur || cur < today) {
        setCurrentDate(today);
      }
    } catch (e) {
      void e;
    }
  }

  let timer: number | null = null;

  onMounted(() => {
    rolloverIfStale();
    try {
      timer = window.setInterval(rolloverIfStale, 60 * 1000);
    } catch (e) {
      void e;
    }
  });

  onBeforeUnmount(() => {
    try {
      if (timer !== null) clearInterval(timer);
    } catch (e) {
      void e;
    }
  });
}
