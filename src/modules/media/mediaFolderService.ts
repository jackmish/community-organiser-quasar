export type MediaFolderEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number | null;
  modifiedMs: number | null;
};

export type ListMediaFolderResult =
  | {
      ok: true;
      rootPath: string;
      currentPath: string;
      parentPath: string | null;
      canGoUp: boolean;
      entries: MediaFolderEntry[];
    }
  | { ok: false; error: string };

type MediaFolderElectronAPI = {
  listMediaFolder?: (payload: {
    rootPath: string;
    currentPath?: string | null;
  }) => Promise<ListMediaFolderResult>;
  openMediaPath?: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
  revealMediaPath?: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
};

function mediaFolderApi(): MediaFolderElectronAPI | null {
  const api = (window as unknown as { electronAPI?: MediaFolderElectronAPI }).electronAPI;
  if (!api?.listMediaFolder) return null;
  return api;
}

export function isMediaFolderBrowserAvailable(): boolean {
  return mediaFolderApi() != null;
}

export async function listMediaFolder(
  rootPath: string,
  currentPath?: string | null,
): Promise<ListMediaFolderResult> {
  const api = mediaFolderApi();
  if (!api?.listMediaFolder) {
    return { ok: false, error: 'Folder browser is only available in the desktop app' };
  }
  return api.listMediaFolder({
    rootPath,
    ...(currentPath !== undefined ? { currentPath } : {}),
  });
}

export async function openMediaPath(targetPath: string): Promise<{ ok: boolean; error?: string }> {
  const api = mediaFolderApi();
  if (!api?.openMediaPath) return { ok: false, error: 'Not available' };
  return api.openMediaPath(targetPath);
}

export async function revealMediaPath(targetPath: string): Promise<{ ok: boolean; error?: string }> {
  const api = mediaFolderApi();
  if (!api?.revealMediaPath) return { ok: false, error: 'Not available' };
  return api.revealMediaPath(targetPath);
}

export const IMAGE_FILE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.avif',
  '.heic',
]);

export function isImageFileName(name: string): boolean {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) return false;
  return IMAGE_FILE_EXTENSIONS.has(lower.slice(dot));
}
