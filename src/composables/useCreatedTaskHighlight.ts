import { nextTick, onBeforeUnmount, ref } from 'vue';

const HIGHLIGHT_MS = 1150;
const SCROLL_RETRY_MS = 50;
const SCROLL_MAX_ATTEMPTS = 20;

export function useCreatedTaskHighlight() {
  const highlightedTaskId = ref<string | null>(null);
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  onBeforeUnmount(() => {
    if (clearTimer) clearTimeout(clearTimer);
  });

  async function scrollToTaskElement(taskId: string): Promise<void> {
    const selector = `[data-task-id="${taskId}"]`;
    for (let attempt = 0; attempt < SCROLL_MAX_ATTEMPTS; attempt += 1) {
      const el = document.querySelector(selector);
      if (el instanceof Element) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, SCROLL_RETRY_MS));
    }
  }

  async function highlightCreatedTask(taskId: string): Promise<void> {
    const id = String(taskId);
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }

    highlightedTaskId.value = id;
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await scrollToTaskElement(id);

    clearTimer = setTimeout(() => {
      if (highlightedTaskId.value === id) highlightedTaskId.value = null;
      clearTimer = null;
    }, HIGHLIGHT_MS);
  }

  return { highlightedTaskId, highlightCreatedTask } as const;
}
