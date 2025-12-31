import { ref } from 'vue';

export function useLongPress() {
  const longPressTimer = ref<number | null>(null);
  const longPressTriggered = ref(false);
  const LONG_PRESS_MS = 600;

  let handler: ((task: any) => void) | null = null;

  const setLongPressHandler = (fn: (task: any) => void) => {
    handler = fn;
  };

  function startLongPress(task: any, ev?: Event) {
    cancelLongPress();
    longPressTriggered.value = false;
    longPressTimer.value = window.setTimeout(() => {
      longPressTriggered.value = true;
      if (handler) handler(task);
    }, LONG_PRESS_MS) as unknown as number;
  }

  function cancelLongPress() {
    if (longPressTimer.value !== null) {
      clearTimeout(longPressTimer.value as unknown as number);
      longPressTimer.value = null;
    }
  }

  return { startLongPress, cancelLongPress, longPressTriggered, setLongPressHandler };
}
