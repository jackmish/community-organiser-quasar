import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  deleteCapacitorDataFile,
  listCapacitorDirNames,
} from 'src/modules/storage/backend/mobile/capacitorAppDataFiles';
import logger from 'src/utils/logger';

async function deleteRecursive(relativePath: string): Promise<void> {
  const names = await listCapacitorDirNames(relativePath);
  for (const name of names) {
    const child = `${relativePath}/${name}`;
    const nested = await listCapacitorDirNames(child);
    if (nested.length > 0) {
      await deleteRecursive(child);
    } else {
      await deleteCapacitorDataFile(child);
    }
  }
  try {
    await Filesystem.rmdir({
      path: relativePath,
      directory: Directory.Data,
      recursive: true,
    });
  } catch (err) {
    logger.warn('[capacitorSpaceStorage] rmdir failed', relativePath, err);
  }
}

/** Remove a custom workspace folder tree from app data. */
export async function deleteCapacitorWorkspaceTree(relativePath: string): Promise<void> {
  const trimmed = relativePath.trim();
  if (!trimmed || trimmed === '.' || trimmed === '/') {
    throw new Error('Cannot delete the application data folder');
  }
  await deleteRecursive(trimmed);
}
