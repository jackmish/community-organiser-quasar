import type { IpcMain } from 'electron';
import { nativeImage } from 'electron';
import crypto from 'crypto';
import type { Dirent } from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { resolveInsideRoot } from './mediaFolderMain';
import { resolveActiveDataPath } from './spaceRegistryMain';

/** Bump folder name when thumb spec / algorithm changes (old cache left for TTL sweep). */
export const MEDIA_THUMB_CACHE_VERSION = 'v1';
export const MEDIA_THUMB_MAX_EDGE = 160;
const MEDIA_THUMB_JPEG_QUALITY = 82;
const MEDIA_THUMB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MEDIA_THUMB_MAX_BYTES = 250 * 1024 * 1024;
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const THUMBABLE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
]);

type ThumbMeta = {
  sourcePath: string;
  mtimeMs: number;
  spec: string;
  lastUsedMs: number;
  sizeBytes: number;
};

type GetThumbOk = { ok: true; dataUrl: string };
type GetThumbErr = { ok: false; error?: string; noThumb?: boolean };

export type GetMediaThumbPayload = GetThumbOk | GetThumbErr;

function thumbSpecLabel(): string {
  return `s${MEDIA_THUMB_MAX_EDGE}`;
}

function isThumbableFileName(name: string): boolean {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) return false;
  return THUMBABLE_EXTENSIONS.has(lower.slice(dot));
}

function thumbCacheKey(sourcePath: string, mtimeMs: number): string {
  const input = `${path.resolve(sourcePath)}\0${mtimeMs}\0${thumbSpecLabel()}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

function thumbRelPaths(hash: string): { imageRel: string; metaRel: string } {
  const shardA = hash.slice(0, 2);
  const shardB = hash.slice(2, 4);
  const base = path.join(MEDIA_THUMB_CACHE_VERSION, shardA, shardB, hash);
  return {
    imageRel: `${base}.jpg`,
    metaRel: `${base}.jpg.meta.json`,
  };
}

function thumbCacheRoot(appDataPath: string): string {
  return path.join(appDataPath, 'cache', 'media-thumbs');
}

function thumbAbsPaths(appDataPath: string, hash: string): { imagePath: string; metaPath: string } {
  const { imageRel, metaRel } = thumbRelPaths(hash);
  const root = thumbCacheRoot(appDataPath);
  return {
    imagePath: path.join(root, imageRel),
    metaPath: path.join(root, metaRel),
  };
}

async function readThumbMeta(metaPath: string): Promise<ThumbMeta | null> {
  try {
    const raw = await fsPromises.readFile(metaPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ThumbMeta>;
    if (
      typeof parsed.sourcePath !== 'string' ||
      typeof parsed.mtimeMs !== 'number' ||
      typeof parsed.lastUsedMs !== 'number' ||
      typeof parsed.sizeBytes !== 'number'
    ) {
      return null;
    }
    return {
      sourcePath: parsed.sourcePath,
      mtimeMs: parsed.mtimeMs,
      spec: typeof parsed.spec === 'string' ? parsed.spec : thumbSpecLabel(),
      lastUsedMs: parsed.lastUsedMs,
      sizeBytes: parsed.sizeBytes,
    };
  } catch {
    return null;
  }
}

async function writeThumbMeta(metaPath: string, meta: ThumbMeta): Promise<void> {
  await fsPromises.mkdir(path.dirname(metaPath), { recursive: true });
  await fsPromises.writeFile(metaPath, JSON.stringify(meta), 'utf8');
}

async function deleteThumbFiles(imagePath: string, metaPath: string): Promise<void> {
  await Promise.all([
    fsPromises.unlink(imagePath).catch(() => undefined),
    fsPromises.unlink(metaPath).catch(() => undefined),
  ]);
}

async function touchThumbMeta(metaPath: string, meta: ThumbMeta): Promise<void> {
  const next: ThumbMeta = { ...meta, lastUsedMs: Date.now() };
  await writeThumbMeta(metaPath, next);
}

async function fileToDataUrl(imagePath: string): Promise<string> {
  const buf = await fsPromises.readFile(imagePath);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function generateThumbBuffer(sourcePath: string): Promise<Buffer | null> {
  const image = nativeImage.createFromPath(sourcePath);
  if (image.isEmpty()) return null;

  const { width: srcW, height: srcH } = image.getSize();
  if (srcW <= 0 || srcH <= 0) return null;

  let width = srcW;
  let height = srcH;
  const maxEdge = MEDIA_THUMB_MAX_EDGE;
  if (width > maxEdge || height > maxEdge) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxEdge) / width));
      width = maxEdge;
    } else {
      width = Math.max(1, Math.round((width * maxEdge) / height));
      height = maxEdge;
    }
  }

  const resized =
    width === srcW && height === srcH
      ? image
      : image.resize({ width, height, quality: 'good' });
  return resized.toJPEG(MEDIA_THUMB_JPEG_QUALITY);
}

async function walkMetaFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = await fsPromises.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMetaFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.jpg.meta.json')) {
      out.push(full);
    }
  }
  return out;
}

let lastSweepMs = 0;
let sweepScheduled = false;

async function sweepThumbCache(appDataPath: string, force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSweepMs < SWEEP_INTERVAL_MS) return;
  lastSweepMs = now;

  const root = thumbCacheRoot(appDataPath);
  const metaPaths = await walkMetaFiles(root);
  const survivors: Array<{ metaPath: string; imagePath: string; meta: ThumbMeta }> = [];

  for (const metaPath of metaPaths) {
    const imagePath = metaPath.replace(/\.meta\.json$/, '');
    const meta = await readThumbMeta(metaPath);
    if (!meta) {
      await deleteThumbFiles(imagePath, metaPath);
      continue;
    }

    let remove = false;
    if (meta.spec !== thumbSpecLabel()) {
      remove = true;
    } else if (now - meta.lastUsedMs > MEDIA_THUMB_TTL_MS) {
      remove = true;
    } else {
      try {
        const stat = await fsPromises.stat(meta.sourcePath);
        if (!stat.isFile() || Math.round(stat.mtimeMs) !== Math.round(meta.mtimeMs)) {
          remove = true;
        }
      } catch {
        remove = true;
      }
    }

    if (remove) {
      await deleteThumbFiles(imagePath, metaPath);
      continue;
    }

    try {
      await fsPromises.access(imagePath);
      survivors.push({ metaPath, imagePath, meta });
    } catch {
      await deleteThumbFiles(imagePath, metaPath);
    }
  }

  let totalBytes = survivors.reduce((sum, row) => sum + row.meta.sizeBytes, 0);
  if (totalBytes <= MEDIA_THUMB_MAX_BYTES) return;

  survivors.sort((a, b) => a.meta.lastUsedMs - b.meta.lastUsedMs);
  for (const row of survivors) {
    if (totalBytes <= MEDIA_THUMB_MAX_BYTES) break;
    await deleteThumbFiles(row.imagePath, row.metaPath);
    totalBytes -= row.meta.sizeBytes;
  }
}

function scheduleThumbSweep(appDataPath: string): void {
  if (sweepScheduled) return;
  sweepScheduled = true;
  setTimeout(() => {
    void sweepThumbCache(appDataPath).catch(() => undefined);
  }, 15_000);
}

async function getOrCreateThumb(
  appDataPath: string,
  sourcePath: string,
  mtimeMs: number,
): Promise<GetMediaThumbPayload> {
  const hash = thumbCacheKey(sourcePath, mtimeMs);
  const { imagePath, metaPath } = thumbAbsPaths(appDataPath, hash);

  try {
    await fsPromises.access(imagePath);
    const meta = await readThumbMeta(metaPath);
    if (meta && Math.round(meta.mtimeMs) === Math.round(mtimeMs)) {
      void touchThumbMeta(metaPath, meta);
      const dataUrl = await fileToDataUrl(imagePath);
      return { ok: true, dataUrl };
    }
    await deleteThumbFiles(imagePath, metaPath);
  } catch {
    // cache miss — generate below
  }

  const buffer = await generateThumbBuffer(sourcePath);
  if (!buffer || buffer.length === 0) {
    return { ok: false, noThumb: true };
  }

  await fsPromises.mkdir(path.dirname(imagePath), { recursive: true });
  await fsPromises.writeFile(imagePath, buffer);
  const meta: ThumbMeta = {
    sourcePath,
    mtimeMs,
    spec: thumbSpecLabel(),
    lastUsedMs: Date.now(),
    sizeBytes: buffer.length,
  };
  await writeThumbMeta(metaPath, meta);

  return { ok: true, dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}` };
}

export function registerMediaThumbIpc(ipcMain: IpcMain): void {
  ipcMain.handle(
    'media:get-thumb',
    async (
      _evt,
      payload: { rootPath?: string; filePath?: string; modifiedMs?: number | null },
    ): Promise<GetMediaThumbPayload> => {
      try {
        const rootPath = String(payload?.rootPath || '').trim();
        const filePath = String(payload?.filePath || '').trim();
        if (!rootPath || !filePath) {
          return { ok: false, error: 'Missing path' };
        }

        const resolvedFile = resolveInsideRoot(rootPath, filePath);
        if (!resolvedFile) {
          return { ok: false, error: 'Path outside task folder' };
        }

        if (!isThumbableFileName(path.basename(resolvedFile))) {
          return { ok: false, noThumb: true };
        }

        let stat;
        try {
          stat = await fsPromises.stat(resolvedFile);
        } catch {
          return { ok: false, error: 'File not found' };
        }
        if (!stat.isFile()) {
          return { ok: false, error: 'Not a file' };
        }

        const mtimeMs =
          payload?.modifiedMs != null && Number.isFinite(payload.modifiedMs)
            ? Number(payload.modifiedMs)
            : stat.mtimeMs;

        const appDataPath = resolveActiveDataPath();
        scheduleThumbSweep(appDataPath);
        return await getOrCreateThumb(appDataPath, resolvedFile, mtimeMs);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Failed to load thumbnail' };
      }
    },
  );
}
