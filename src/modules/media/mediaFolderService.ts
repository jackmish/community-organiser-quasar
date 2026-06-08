import type { MediaGalleryTagAction } from './mediaGalleryTagModel';

export type MediaFolderEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number | null;
  createdMs: number | null;
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

export type GetMediaThumbnailResult =
  | { ok: true; url: string }
  | { ok: false; error?: string; noThumb?: boolean };

export type GetMediaThumbnailsBatchResult =
  | { ok: true; thumbs: Record<string, GetMediaThumbnailResult> }
  | { ok: false; error?: string };

export type ClearMediaThumbnailCacheResult =
  | { ok: true; fileCount: number }
  | { ok: false; error?: string };

export type MoveMediaToTagFolderResult =
  | { ok: true; newPath: string; folderName: string }
  | { ok: false; error?: string };

export type GetMediaFullImageUrlResult =
  | { ok: true; url: string }
  | { ok: false; error?: string };

export type ApplyMediaGalleryTagResult =
  | { ok: true; newPath: string; detail?: string }
  | { ok: false; error?: string };

type MediaFolderElectronAPI = {
  listMediaFolder?: (payload: {
    rootPath: string;
    currentPath?: string | null;
  }) => Promise<ListMediaFolderResult>;
  getMediaThumbnail?: (payload: {
    rootPath: string;
    filePath: string;
    modifiedMs?: number | null;
    maxEdge?: number;
  }) => Promise<GetMediaThumbnailResult>;
  getMediaThumbnails?: (payload: {
    rootPath: string;
    maxEdge?: number;
    items: Array<{ filePath: string; modifiedMs?: number | null }>;
  }) => Promise<GetMediaThumbnailsBatchResult>;
  clearMediaThumbnailCache?: () => Promise<ClearMediaThumbnailCacheResult>;
  openMediaPath?: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
  revealMediaPath?: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
  moveMediaToTagFolder?: (payload: {
    rootPath: string;
    filePath: string;
    folderName: string;
  }) => Promise<MoveMediaToTagFolderResult>;
  applyMediaGalleryTag?: (payload: {
    rootPath: string;
    filePath: string;
    tag: MediaGalleryTagAction;
  }) => Promise<ApplyMediaGalleryTagResult>;
  getMediaFullImageUrl?: (payload: {
    rootPath: string;
    filePath: string;
  }) => Promise<GetMediaFullImageUrlResult>;
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

export async function getMediaThumbnail(
  rootPath: string,
  filePath: string,
  modifiedMs?: number | null,
  maxEdge?: number,
): Promise<GetMediaThumbnailResult> {
  const api = mediaFolderApi();
  if (!api?.getMediaThumbnail) {
    return { ok: false, error: 'Thumbnails are only available in the desktop app' };
  }
  return api.getMediaThumbnail({
    rootPath,
    filePath,
    ...(modifiedMs !== undefined ? { modifiedMs } : {}),
    ...(maxEdge !== undefined ? { maxEdge } : {}),
  });
}

export async function getMediaThumbnails(
  rootPath: string,
  items: Array<{ filePath: string; modifiedMs?: number | null }>,
  maxEdge?: number,
): Promise<GetMediaThumbnailsBatchResult> {
  const api = mediaFolderApi();
  if (!api?.getMediaThumbnails) {
    return { ok: false, error: 'Thumbnails are only available in the desktop app' };
  }
  return api.getMediaThumbnails({
    rootPath,
    items,
    ...(maxEdge !== undefined ? { maxEdge } : {}),
  });
}

export async function clearMediaThumbnailCache(): Promise<ClearMediaThumbnailCacheResult> {
  const api = mediaFolderApi();
  if (!api?.clearMediaThumbnailCache) {
    return { ok: false, error: 'Thumbnails are only available in the desktop app' };
  }
  return api.clearMediaThumbnailCache();
}

export async function moveMediaToTagFolder(
  rootPath: string,
  filePath: string,
  folderName: string,
): Promise<MoveMediaToTagFolderResult> {
  const api = mediaFolderApi();
  if (!api?.moveMediaToTagFolder) {
    return { ok: false, error: 'File tagging is only available in the desktop app' };
  }
  return api.moveMediaToTagFolder({ rootPath, filePath, folderName });
}

export async function applyMediaGalleryTag(
  rootPath: string,
  filePath: string,
  tag: MediaGalleryTagAction,
): Promise<ApplyMediaGalleryTagResult> {
  const api = mediaFolderApi();
  if (!api?.applyMediaGalleryTag) {
    return { ok: false, error: 'File tagging is only available in the desktop app' };
  }
  return api.applyMediaGalleryTag({ rootPath, filePath, tag });
}

export async function getMediaFullImageUrl(
  rootPath: string,
  filePath: string,
): Promise<GetMediaFullImageUrlResult> {
  const api = mediaFolderApi();
  if (!api?.getMediaFullImageUrl) {
    return { ok: false, error: 'Full image preview is only available in the desktop app' };
  }
  return api.getMediaFullImageUrl({ rootPath, filePath });
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

/** Raster formats supported for cached thumbnails (excludes svg). */
export const THUMBABLE_FILE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
  '.heic',
  '.heif',
]);

export function isThumbableFileName(name: string): boolean {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) return false;
  return THUMBABLE_FILE_EXTENSIONS.has(lower.slice(dot));
}
