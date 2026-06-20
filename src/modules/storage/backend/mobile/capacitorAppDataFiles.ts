import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import logger from 'src/utils/logger';

export function isNativeCapacitorPlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isMissingPathError(err: unknown): boolean {
  if (typeof err === 'string') return isMissingPathMessage(err);
  if (err instanceof Error) return isMissingPathMessage(err.message);
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return isMissingPathMessage((err as { message: string }).message);
  }
  return false;
}

function isMissingPathMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes('does not exist') || lower.includes('not found') || lower.includes('enoent');
}

export async function ensureCapacitorDataDir(relativeDir: string): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: relativeDir,
      directory: Directory.Data,
      recursive: true,
    });
  } catch (err) {
    if (!isMissingPathError(err)) {
      logger.warn('[capacitorAppDataFiles] mkdir failed', relativeDir, err);
    }
  }
}

export async function readCapacitorTextFile(relativePath: string): Promise<string | null> {
  try {
    const { data } = await Filesystem.readFile({
      path: relativePath,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return typeof data === 'string' ? data : null;
  } catch (err) {
    if (isMissingPathError(err)) return null;
    logger.error('[capacitorAppDataFiles] read failed', relativePath, err);
    return null;
  }
}

export async function writeCapacitorTextFile(relativePath: string, text: string): Promise<void> {
  const slash = relativePath.lastIndexOf('/');
  if (slash > 0) {
    await ensureCapacitorDataDir(relativePath.slice(0, slash));
  }
  await Filesystem.writeFile({
    path: relativePath,
    data: text,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });
}

export async function readCapacitorJsonFile(relativePath: string): Promise<unknown> {
  const text = await readCapacitorTextFile(relativePath);
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    logger.error('[capacitorAppDataFiles] JSON parse failed', relativePath, err);
    return null;
  }
}

export async function writeCapacitorJsonFile(relativePath: string, data: unknown): Promise<void> {
  await writeCapacitorTextFile(relativePath, JSON.stringify(data, null, 2));
}

export async function listCapacitorDirNames(relativeDir: string): Promise<string[]> {
  try {
    await ensureCapacitorDataDir(relativeDir);
    const { files } = await Filesystem.readdir({
      path: relativeDir,
      directory: Directory.Data,
    });
    return (files || []).map((entry) => (typeof entry === 'string' ? entry : entry.name));
  } catch (err) {
    if (isMissingPathError(err)) return [];
    logger.error('[capacitorAppDataFiles] readdir failed', relativeDir, err);
    return [];
  }
}

export async function deleteCapacitorDataFile(relativePath: string): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path: relativePath,
      directory: Directory.Data,
    });
  } catch (err) {
    if (!isMissingPathError(err)) {
      logger.error('[capacitorAppDataFiles] delete failed', relativePath, err);
      throw err;
    }
  }
}

export async function getCapacitorDataUri(relativePath: string): Promise<string> {
  try {
    const { uri } = await Filesystem.getUri({
      path: relativePath,
      directory: Directory.Data,
    });
    return uri;
  } catch {
    return relativePath;
  }
}
