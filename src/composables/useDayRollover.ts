import { onMounted, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import { todayString, yesterdayString } from 'src/utils/dateUtils';

/**
 * Registers a 60-second interval that advances `currentDate` to today when the
 * calendar day rolls over (user was on yesterday and it is now a new day).
 *
 * Does not pull the user off historical dates they navigated to manually.
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
      if (!cur) {
        setCurrentDate(today);
        return;
      }
      if (cur >= today) return;
      // Only advance across midnight — not when browsing older days.
      if (cur === yesterdayString()) {
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
