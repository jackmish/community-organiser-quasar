import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useClock(intervalMs = 1000) {
  const now = ref<Date>(new Date());
  let timer: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    if (timer) return;
    timer = setInterval(() => (now.value = new Date()), intervalMs);
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  onMounted(start);
  onBeforeUnmount(stop);

  return { now, start, stop } as const;
}
