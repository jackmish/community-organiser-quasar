import { ref, onMounted, onBeforeUnmount } from 'vue';
import { timeDiffClassFor } from 'src/components/theme';

export function useDayOrganiserView() {
  const now = ref<Date>(new Date());
  let clockTimer: any = null;

  onMounted(() => {
    clockTimer = setInterval(() => {
      now.value = new Date();
    }, 1000);
  });

  onBeforeUnmount(() => {
    if (clockTimer) clearInterval(clockTimer);
  });

  function getTimeDifferenceDisplay(dayDate: string) {
    if (!dayDate) return 'Select a date';

    const date = new Date(dayDate);
    const todayDate = new Date();

    const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayNormalized = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      todayDate.getDate(),
    );

    const daysDiff = Math.floor(
      (dateNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff === 0) return 'TODAY';
    if (daysDiff === 1) return 'TOMORROW';
    if (daysDiff === -1) return 'YESTERDAY';

    if (daysDiff > 0) {
      const weeksDiff = Math.floor(daysDiff / 7);

      if (weeksDiff >= 1) {
        const remainingDays = daysDiff % 7;
        if (remainingDays > 0) {
          const weekText = weeksDiff === 1 ? 'week' : 'weeks';
          const dayText = remainingDays === 1 ? 'day' : 'days';
          return `In ${weeksDiff} ${weekText} ${remainingDays} ${dayText}`;
        }
        const weekText = weeksDiff === 1 ? 'week' : 'weeks';
        return `In ${weeksDiff} ${weekText}`;
      }

      const dayText = daysDiff === 1 ? 'day' : 'days';
      return `In ${daysDiff} ${dayText}`;
    } else {
      const absDaysDiff = Math.abs(daysDiff);
      const weeksDiff = Math.floor(absDaysDiff / 7);

      if (weeksDiff >= 1) {
        const remainingDays = absDaysDiff % 7;
        if (remainingDays > 0) {
          const weekText = weeksDiff === 1 ? 'week' : 'weeks';
          const dayText = remainingDays === 1 ? 'day' : 'days';
          return `${weeksDiff} ${weekText} ${remainingDays} ${dayText} ago`;
        }
        const weekText = weeksDiff === 1 ? 'week' : 'weeks';
        return `${weeksDiff} ${weekText} ago`;
      }

      const dayText = absDaysDiff === 1 ? 'day' : 'days';
      return `${absDaysDiff} ${dayText} ago`;
    }
  }

  function getTimeDiffClass(dayDate: string) {
    return timeDiffClassFor(getTimeDifferenceDisplay(dayDate));
  }

  return {
    now,
    getTimeDifferenceDisplay,
    getTimeDiffClass,
  } as const;
}
