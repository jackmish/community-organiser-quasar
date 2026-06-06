import type { IpcMain } from 'electron';
import { protocol } from 'electron';
import sharp from 'sharp';
import crypto from 'crypto';
import type { Dirent } from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { resolveInsideRoot } from './mediaFolderMain';
import { resolveActiveDataPath } from './spaceRegistryMain';

/** Bump folder name when thumb spec / algorithm changes (old cache left for TTL sweep). */
export const MEDIA_THUMB_CACHE_VERSION = 'v1';
export const MEDIA_THUMB_MAX_EDGE = 160;
const MEDIA_THUMB_JPEG_QUALITY = 78;
const MEDIA_THUMB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MEDIA_THUMB_MAX_BYTES = 250 * 1024 * 1024;
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_GENERATIONS = 2;
const BATCH_THUMB_CONCURRENCY = 4;
const META_TOUCH_FLUSH_MS = 60_000;

const THUMBABLE_EXTENSIONS = new Set([
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

type ThumbMeta = {
  sourcePath: string;
  mtimeMs: number;
  spec: string;
  lastUsedMs: number;
  sizeBytes: number;
};

type GetThumbOk = { ok: true; url: string };
type GetThumbErr = { ok: false; error?: string; noThumb?: boolean };

export type GetMediaThumbPayload = GetThumbOk | GetThumbErr;

export type GetMediaThumbsBatchPayload =
  | { ok: true; thumbs: Record<string, GetMediaThumbPayload> }
  | { ok: false; error: string };

export type ClearMediaThumbCachePayload =
  | { ok: true; fileCount: number }
  | { ok: false; error: string };

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

function thumbCacheUrl(imageRel: string): string {
  const normalized = imageRel.replace(/\\/g, '/');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `media-thumb://cache/${encoded}`;
}

function resolveCachedThumbPath(imageRel: string): string | null {
  const rel = String(imageRel || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!rel || rel.includes('..')) return null;

  const appDataPath = resolveActiveDataPath();
  const root = path.resolve(thumbCacheRoot(appDataPath));
  const filePath = path.resolve(path.join(root, rel));
  const relCheck = path.relative(root, filePath);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return filePath;
}

export function registerMediaThumbProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media-thumb',
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

export function registerMediaThumbProtocol(): void {
  protocol.handle('media-thumb', async (request) => {
    try {
      const url = new URL(request.url);
      const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const filePath = resolveCachedThumbPath(rel);
      if (!filePath) {
        return new Response('Forbidden', { status: 403 });
      }
      const data = await fsPromises.readFile(filePath);
      return new Response(data, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'private, max-age=31536000, immutable',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
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
  pendingMetaTouches.delete(metaPath);
  await Promise.all([
    fsPromises.unlink(imagePath).catch(() => undefined),
    fsPromises.unlink(metaPath).catch(() => undefined),
  ]);
}

const pendingMetaTouches = new Map<string, ThumbMeta>();
let metaFlushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleMetaTouch(metaPath: string, meta: ThumbMeta): void {
  pendingMetaTouches.set(metaPath, { ...meta, lastUsedMs: Date.now() });
  if (metaFlushTimer) return;
  metaFlushTimer = setTimeout(() => {
    metaFlushTimer = null;
    void flushMediaThumbMetaTouches();
  }, META_TOUCH_FLUSH_MS);
}

export async function flushMediaThumbMetaTouches(): Promise<void> {
  if (metaFlushTimer) {
    clearTimeout(metaFlushTimer);
    metaFlushTimer = null;
  }
  const entries = [...pendingMetaTouches.entries()];
  pendingMetaTouches.clear();
  await Promise.all(entries.map(([p, m]) => writeThumbMeta(p, m).catch(() => undefined)));
}

let activeGenerations = 0;
const generationWaiters: Array<() => void> = [];

function runWithGenerationSlot<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeGenerations += 1;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeGenerations -= 1;
          const next = generationWaiters.shift();
          if (next) next();
        });
    };
    if (activeGenerations < MAX_CONCURRENT_GENERATIONS) run();
    else generationWaiters.push(run);
  });
}

async function generateThumbBuffer(sourcePath: string): Promise<Buffer | null> {
  return runWithGenerationSlot(async () => {
    try {
      const buffer = await sharp(sourcePath, { failOn: 'none', sequentialRead: true })
        .rotate()
        .resize(MEDIA_THUMB_MAX_EDGE, MEDIA_THUMB_MAX_EDGE, {
          fit: 'inside',
          withoutEnlargement: true,
          fastShrinkOnLoad: true,
        })
        .jpeg({ quality: MEDIA_THUMB_JPEG_QUALITY, mozjpeg: false })
        .toBuffer();
      return buffer.length > 0 ? buffer : null;
    } catch {
      return null;
    }
  });
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

async function countCacheFiles(dir: string): Promise<number> {
  let count = 0;
  let entries: Dirent[];
  try {
    entries = await fsPromises.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += await countCacheFiles(full);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

export async function clearMediaThumbCacheForPath(
  appDataPath: string,
): Promise<ClearMediaThumbCachePayload> {
  await flushMediaThumbMetaTouches();
  const root = thumbCacheRoot(appDataPath);
  try {
    await fsPromises.access(root);
  } catch {
    lastSweepMs = 0;
    sweepScheduled = false;
    return { ok: true, fileCount: 0 };
  }

  try {
    const fileCount = await countCacheFiles(root);
    await fsPromises.rm(root, { recursive: true, force: true });
    lastSweepMs = 0;
    sweepScheduled = false;
    return { ok: true, fileCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || 'Failed to clear thumbnail cache' };
  }
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
  const { imageRel } = thumbRelPaths(hash);
  const { imagePath, metaPath } = thumbAbsPaths(appDataPath, hash);

  try {
    await fsPromises.access(imagePath);
    const meta = await readThumbMeta(metaPath);
    if (meta && Math.round(meta.mtimeMs) === Math.round(mtimeMs)) {
      scheduleMetaTouch(metaPath, meta);
      return { ok: true, url: thumbCacheUrl(imageRel) };
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

  return { ok: true, url: thumbCacheUrl(imageRel) };
}

async function resolveThumbRequest(
  rootPath: string,
  filePath: string,
  modifiedMs: number | null | undefined,
  appDataPath: string,
): Promise<GetMediaThumbPayload> {
  const resolvedFile = resolveInsideRoot(rootPath, filePath);
  if (!resolvedFile) {
    return { ok: false, error: 'Path outside task folder' };
  }

  if (!isThumbableFileName(path.basename(resolvedFile))) {
    return { ok: false, noThumb: true };
  }

  let mtimeMs: number | null =
    modifiedMs != null && Number.isFinite(modifiedMs) ? Number(modifiedMs) : null;

  if (mtimeMs == null) {
    try {
      const stat = await fsPromises.stat(resolvedFile);
      if (!stat.isFile()) return { ok: false, error: 'Not a file' };
      mtimeMs = stat.mtimeMs;
    } catch {
      return { ok: false, error: 'File not found' };
    }
  }

  return getOrCreateThumb(appDataPath, resolvedFile, mtimeMs);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
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

        const appDataPath = resolveActiveDataPath();
        scheduleThumbSweep(appDataPath);
        return await resolveThumbRequest(rootPath, filePath, payload?.modifiedMs, appDataPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Failed to load thumbnail' };
      }
    },
  );

  ipcMain.handle(
    'media:get-thumbs',
    async (
      _evt,
      payload: {
        rootPath?: string;
        items?: Array<{ filePath?: string; modifiedMs?: number | null }>;
      },
    ): Promise<GetMediaThumbsBatchPayload> => {
      try {
        const rootPath = String(payload?.rootPath || '').trim();
        const items = Array.isArray(payload?.items) ? payload.items : [];
        if (!rootPath) {
          return { ok: false, error: 'Missing root path' };
        }

        const appDataPath = resolveActiveDataPath();
        scheduleThumbSweep(appDataPath);

        const thumbs: Record<string, GetMediaThumbPayload> = {};
        await mapWithConcurrency(items, BATCH_THUMB_CONCURRENCY, async (item) => {
          const filePath = String(item?.filePath || '').trim();
          if (!filePath) return;
          thumbs[filePath] = await resolveThumbRequest(
            rootPath,
            filePath,
            item?.modifiedMs,
            appDataPath,
          );
        });

        return { ok: true, thumbs };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Failed to load thumbnails' };
      }
    },
  );

  ipcMain.handle('media:clear-thumb-cache', async (): Promise<ClearMediaThumbCachePayload> => {
    try {
      return await clearMediaThumbCacheForPath(resolveActiveDataPath());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg || 'Failed to clear thumbnail cache' };
    }
  });
}
