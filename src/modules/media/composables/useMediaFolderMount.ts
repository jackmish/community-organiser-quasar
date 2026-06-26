import { ref } from 'vue';
import type { MediaFolderMountHint } from '../unixPartitionMountModel';
import {
  checkMediaFolderAccess,
  listMediaFolderMountHint,
  tryMountUnixPartition,
  type ListMediaFolderResult,
} from '../mediaFolderService';

export function useMediaFolderMount() {
  const mountHint = ref<MediaFolderMountHint | null>(null);
  const mountBusy = ref(false);
  const mountError = ref('');

  function setMountHintFromListResult(result: ListMediaFolderResult): void {
    mountHint.value = listMediaFolderMountHint(result);
    if (!mountHint.value) mountError.value = '';
  }

  async function probeFolderAccess(folderPath: string): Promise<void> {
    const path = String(folderPath || '').trim();
    if (!path) {
      mountHint.value = null;
      return;
    }
    const result = await checkMediaFolderAccess(path);
    if (!result.ok) {
      mountHint.value = null;
      return;
    }
    mountHint.value = result.accessible ? null : result.hint;
    if (result.accessible) mountError.value = '';
  }

  async function tryMount(folderPath?: string): Promise<boolean> {
    const hint = mountHint.value;
    if (!hint?.canTryMount) return false;

    const targetFolder = String(folderPath || hint.folderPath || '').trim();
    const targetMount = String(hint.mountPoint || '').trim();

    mountBusy.value = true;
    mountError.value = '';
    try {
      const result = targetFolder
        ? await tryMountUnixPartition('', { folderPath: targetFolder })
        : targetMount
          ? await tryMountUnixPartition(targetMount)
          : { ok: false as const, error: 'No folder or mount point' };
      if (!result.ok) {
        mountError.value = result.error;
        return false;
      }
      mountHint.value = null;
      return true;
    } finally {
      mountBusy.value = false;
    }
  }

  function clearMountState(): void {
    mountHint.value = null;
    mountError.value = '';
    mountBusy.value = false;
  }

  return {
    mountHint,
    mountBusy,
    mountError,
    setMountHintFromListResult,
    probeFolderAccess,
    tryMount,
    clearMountState,
  };
}
