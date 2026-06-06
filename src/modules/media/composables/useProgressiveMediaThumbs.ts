import { onBeforeUnmount, ref } from 'vue';
import {
  getMediaThumbnail,
  isThumbableFileName,
  type MediaFolderEntry,
} from '../mediaFolderService';

const DEFAULT_THUMB_CONCURRENCY = 4;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (!items.length) return;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await fn(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}

/**
 * Loads folder thumbnails progressively (limited parallel IPC), updating UI as each completes.
 */
export function useProgressiveMediaThumbs(concurrency = DEFAULT_THUMB_CONCURRENCY) {
  const thumbUrls = ref<Record<string, string>>({});
  let loadGen = 0;

  function cancelPending(): void {
    loadGen += 1;
  }

  function reset(): void {
    cancelPending();
    thumbUrls.value = {};
  }

  async function loadThumbs(rootPath: string, entries: MediaFolderEntry[]): Promise<void> {
    const root = String(rootPath || '').trim();
    if (!root) return;

    const gen = ++loadGen;
    const targets = entries.filter((e) => !e.isDirectory && isThumbableFileName(e.name));
    if (!targets.length) return;

    await runWithConcurrency(targets, concurrency, async (entry) => {
      if (gen !== loadGen) return;
      const result = await getMediaThumbnail(root, entry.path, entry.modifiedMs);
      if (gen !== loadGen || !result.ok || !result.url) return;
      thumbUrls.value = { ...thumbUrls.value, [entry.path]: result.url };
    });
  }

  onBeforeUnmount(() => {
    cancelPending();
  });

  return { thumbUrls, loadThumbs, reset, cancelPending };
}
