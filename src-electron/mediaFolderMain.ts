import type { IpcMain } from 'electron';
import { protocol, shell } from 'electron';
import type { Stats } from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

export type MediaFolderEntryPayload = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number | null;
  createdMs: number | null;
  modifiedMs: number | null;
};

type ListOk = {
  ok: true;
  rootPath: string;
  currentPath: string;
  parentPath: string | null;
  canGoUp: boolean;
  entries: MediaFolderEntryPayload[];
};

type ListErr = { ok: false; error: string };

export type ListMediaFolderPayload = ListOk | ListErr;

export function resolveInsideRoot(rootPath: string, candidatePath?: string): string | null {
  const root = path.resolve(String(rootPath || ''));
  if (!root) return null;
  const target = path.resolve(candidatePath ? String(candidatePath) : root);
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return target;
}

async function listDirectory(currentPath: string): Promise<MediaFolderEntryPayload[]> {
  const dirents = await fsPromises.readdir(currentPath, { withFileTypes: true });
  const entries: MediaFolderEntryPayload[] = [];

  for (const dirent of dirents) {
    const name = dirent.name;
    if (!name || name === '.' || name === '..') continue;
    const fullPath = path.join(currentPath, name);
    let size: number | null = null;
    let createdMs: number | null = null;
    let modifiedMs: number | null = null;
    try {
      const stat = await fsPromises.stat(fullPath);
      if (!stat.isDirectory()) size = stat.size;
      modifiedMs = stat.mtimeMs;
      createdMs = stat.birthtimeMs;
      if (!createdMs || !Number.isFinite(createdMs)) {
        createdMs = stat.ctimeMs;
      }
    } catch {
      // ignore unreadable entries
    }
    entries.push({
      name,
      path: fullPath,
      isDirectory: dirent.isDirectory(),
      size,
      createdMs,
      modifiedMs,
    });
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return entries;
}

export type MoveMediaToTagFolderPayload =
  | { ok: true; newPath: string; folderName: string }
  | { ok: false; error: string };

export type GetMediaFullImageUrlPayload =
  | { ok: true; url: string }
  | { ok: false; error: string };

type MediaFileProtocolPayload = {
  rootPath: string;
  filePath: string;
};

const PREVIEW_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
  '.heic',
  '.heif',
  '.svg',
]);

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.svg': 'image/svg+xml',
};

function isPreviewImageFileName(name: string): boolean {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) return false;
  return PREVIEW_IMAGE_EXTENSIONS.has(lower.slice(dot));
}

function mimeTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function encodeMediaFileProtocolPayload(payload: MediaFileProtocolPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeMediaFileProtocolPayload(token: string): MediaFileProtocolPayload | null {
  try {
    const raw = String(token || '').replace(/^\/+/, '');
    if (!raw) return null;
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<MediaFileProtocolPayload>;
    if (typeof parsed.rootPath !== 'string' || typeof parsed.filePath !== 'string') return null;
    return { rootPath: parsed.rootPath, filePath: parsed.filePath };
  } catch {
    return null;
  }
}

function buildMediaFileUrl(rootPath: string, filePath: string): string {
  const token = encodeMediaFileProtocolPayload({ rootPath, filePath });
  return `media-file://preview/${encodeURIComponent(token)}`;
}

export function registerMediaFileProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media-file',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

export function registerMediaFileProtocol(): void {
  protocol.handle('media-file', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'preview') {
        return new Response('Forbidden', { status: 403 });
      }
      const token = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const decoded = decodeMediaFileProtocolPayload(token);
      if (!decoded) {
        return new Response('Bad request', { status: 400 });
      }

      const resolved = resolveInsideRoot(decoded.rootPath, decoded.filePath);
      if (!resolved || !isPreviewImageFileName(path.basename(resolved))) {
        return new Response('Forbidden', { status: 403 });
      }

      const stat = await fsPromises.stat(resolved);
      if (!stat.isFile()) {
        return new Response('Not found', { status: 404 });
      }

      const data = await fsPromises.readFile(resolved);
      return new Response(data, {
        headers: {
          'Content-Type': mimeTypeForPath(resolved),
          'Content-Length': String(data.length),
          'Cache-Control': 'private, no-cache',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

async function resolvePreviewImageFile(
  rootPath: string,
  filePath: string,
): Promise<GetMediaFullImageUrlPayload> {
  const resolvedRoot = resolveInsideRoot(rootPath, rootPath);
  if (!resolvedRoot) return { ok: false, error: 'Invalid task folder' };

  const resolvedFile = resolveInsideRoot(rootPath, filePath);
  if (!resolvedFile) return { ok: false, error: 'Path outside task folder' };

  if (!isPreviewImageFileName(path.basename(resolvedFile))) {
    return { ok: false, error: 'Not an image file' };
  }

  try {
    const stat = await fsPromises.stat(resolvedFile);
    if (!stat.isFile()) return { ok: false, error: 'Not a file' };
    const buffer = await fsPromises.readFile(resolvedFile);
    if (!buffer.length) return { ok: false, error: 'Empty file' };
    const mime = mimeTypeForPath(resolvedFile);
    return {
      ok: true,
      url: `data:${mime};base64,${buffer.toString('base64')}`,
    };
  } catch {
    return { ok: false, error: 'File not found' };
  }
}

async function resolveUniqueFilePath(dir: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  let candidate = path.join(dir, fileName);
  let suffix = 1;
  while (true) {
    try {
      await fsPromises.access(candidate);
      candidate = path.join(dir, `${stem} (${suffix})${ext}`);
      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

async function moveFileToRootSubfolder(
  rootPath: string,
  filePath: string,
  subfolderName: string,
): Promise<MoveMediaToTagFolderPayload> {
  const resolvedRoot = resolveInsideRoot(rootPath, rootPath);
  if (!resolvedRoot) return { ok: false, error: 'Invalid task folder' };

  const resolvedFile = resolveInsideRoot(rootPath, filePath);
  if (!resolvedFile) return { ok: false, error: 'Path outside task folder' };

  if (
    subfolderName !== '_ToRemove' &&
    subfolderName !== '_Unsupported' &&
    subfolderName !== '_BadQuality'
  ) {
    return { ok: false, error: 'Invalid tag folder' };
  }

  let fileStat: Stats;
  try {
    fileStat = await fsPromises.stat(resolvedFile);
  } catch {
    return { ok: false, error: 'File not found' };
  }
  if (!fileStat.isFile()) {
    return { ok: false, error: 'Not a file' };
  }

  const destDir = path.join(resolvedRoot, subfolderName);
  await fsPromises.mkdir(destDir, { recursive: true });
  const destPath = await resolveUniqueFilePath(destDir, path.basename(resolvedFile));
  await fsPromises.rename(resolvedFile, destPath);

  return { ok: true, newPath: destPath, folderName: subfolderName };
}

export function registerMediaFolderIpc(ipcMain: IpcMain): void {
  ipcMain.handle(
    'media:list-folder',
    async (_evt, payload: { rootPath?: string; currentPath?: string | null }) => {
      try {
        const rootPath = String(payload?.rootPath || '').trim();
        if (!rootPath) return { ok: false, error: 'No task folder configured' } satisfies ListErr;

        const resolvedRoot = resolveInsideRoot(rootPath, rootPath);
        if (!resolvedRoot) return { ok: false, error: 'Invalid task folder' } satisfies ListErr;

        let rootStat: Stats;
        try {
          rootStat = await fsPromises.stat(resolvedRoot);
        } catch {
          return { ok: false, error: 'Task folder not found' } satisfies ListErr;
        }
        if (!rootStat.isDirectory()) {
          return { ok: false, error: 'Task folder is not a directory' } satisfies ListErr;
        }

        const currentPath = resolveInsideRoot(rootPath, payload?.currentPath || resolvedRoot);
        if (!currentPath) {
          return { ok: false, error: 'Path outside task folder' } satisfies ListErr;
        }

        let currentStat: Stats;
        try {
          currentStat = await fsPromises.stat(currentPath);
        } catch {
          return { ok: false, error: 'Folder not found' } satisfies ListErr;
        }
        if (!currentStat.isDirectory()) {
          return { ok: false, error: 'Not a folder' } satisfies ListErr;
        }

        const atRoot = path.resolve(currentPath) === path.resolve(resolvedRoot);
        const parentPath = atRoot ? null : path.dirname(currentPath);
        const safeParent =
          parentPath && resolveInsideRoot(rootPath, parentPath) ? parentPath : null;

        const entries = await listDirectory(currentPath);
        return {
          ok: true,
          rootPath: resolvedRoot,
          currentPath,
          parentPath: safeParent,
          canGoUp: !atRoot && safeParent != null,
          entries,
        } satisfies ListOk;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Failed to list folder' } satisfies ListErr;
      }
    },
  );

  ipcMain.handle('media:open-path', async (_evt, targetPath: string) => {
    try {
      const p = String(targetPath || '').trim();
      if (!p) return { ok: false, error: 'Empty path' };
      const result = await shell.openPath(p);
      if (result) return { ok: false, error: result };
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle('media:reveal-path', async (_evt, targetPath: string) => {
    try {
      const p = String(targetPath || '').trim();
      if (!p) return { ok: false, error: 'Empty path' };
      shell.showItemInFolder(p);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle(
    'media:move-to-tag-folder',
    async (
      _evt,
      payload: { rootPath?: string; filePath?: string; folderName?: string },
    ): Promise<MoveMediaToTagFolderPayload> => {
      try {
        const rootPath = String(payload?.rootPath || '').trim();
        const filePath = String(payload?.filePath || '').trim();
        const folderName = String(payload?.folderName || '').trim();
        if (!rootPath || !filePath || !folderName) {
          return { ok: false, error: 'Missing path' };
        }
        return await moveFileToRootSubfolder(rootPath, filePath, folderName);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Failed to move file' };
      }
    },
  );

  ipcMain.handle(
    'media:get-full-image-url',
    async (
      _evt,
      payload: { rootPath?: string; filePath?: string },
    ): Promise<GetMediaFullImageUrlPayload> => {
      try {
        const rootPath = String(payload?.rootPath || '').trim();
        const filePath = String(payload?.filePath || '').trim();
        if (!rootPath || !filePath) {
          return { ok: false, error: 'Missing path' };
        }
        return await resolvePreviewImageFile(rootPath, filePath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Failed to open image' };
      }
    },
  );
}
