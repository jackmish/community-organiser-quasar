import type { IpcMain } from 'electron';
import { shell } from 'electron';
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

function resolveInsideRoot(rootPath: string, candidatePath?: string): string | null {
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
}
