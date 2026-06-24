import logger from 'src/utils/logger';
import { APP_DATA_PATH_SEGMENTS } from 'src/modules/storage/appDataPaths';

/** Stored in group JSON instead of inline data URLs. */
export const GROUP_BG_REF_PREFIX = 'group-bg:';

const GROUP_BG_ROOT_SEGMENTS = APP_DATA_PATH_SEGMENTS.groupBackgrounds;

function electronApi() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined;
}

export function isGroupBackgroundRef(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(GROUP_BG_REF_PREFIX);
}

export function groupIdFromBackgroundRef(ref: string): string {
  return ref.slice(GROUP_BG_REF_PREFIX.length).trim();
}

function mimeToExtension(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  return '.jpg';
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  return { mime: match[1] || 'image/jpeg', base64: match[2] || '' };
}

/** Renderer cannot use file:// in CSS; decode for preload readFileBase64 only. */
function fileUrlToPath(fileUrl: string): string {
  let p = fileUrl.replace(/^file:\/\//i, '');
  if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1);
  try {
    p = decodeURIComponent(p);
  } catch {
    void 0;
  }
  return p;
}

const displayDataUrlCache = new Map<string, string>();

export function invalidateGroupBackgroundDisplayCache(refOrGroupId?: string): void {
  if (!refOrGroupId) {
    displayDataUrlCache.clear();
    return;
  }
  const key = refOrGroupId.startsWith(GROUP_BG_REF_PREFIX)
    ? refOrGroupId
    : `${GROUP_BG_REF_PREFIX}${refOrGroupId}`;
  displayDataUrlCache.delete(key);
}

async function filePathToDataUrl(filePath: string): Promise<string | null> {
  const api = electronApi();
  if (!api?.readFileBase64) return null;
  try {
    const read = await api.readFileBase64(filePath);
    if (!read?.base64) return null;
    const mime = read.mime || 'image/jpeg';
    return `data:${mime};base64,${read.base64}`;
  } catch (e) {
    logger.warn('[groupBackgroundStorage] filePathToDataUrl failed', filePath, e);
    return null;
  }
}

async function backgroundsRoot(): Promise<string | null> {
  const api = electronApi();
  if (!api?.getAppDataPath || !api.joinPath || !api.ensureDir) return null;
  const appData = await api.getAppDataPath();
  const dir = api.joinPath(appData, ...GROUP_BG_ROOT_SEGMENTS);
  await api.ensureDir(dir);
  return dir;
}

function groupBackgroundDir(root: string, groupId: string): string {
  const api = electronApi();
  return api!.joinPath(root, String(groupId));
}

/** Remove the whole per-group backgrounds folder (safety before writing a new image). */
export async function purgeGroupBackgroundFilesForGroup(groupId: string): Promise<void> {
  invalidateGroupBackgroundDisplayCache(groupId);
  const api = electronApi();
  const root = await backgroundsRoot();
  if (!api?.joinPath || !root) return;
  const folder = groupBackgroundDir(root, groupId);
  if (api.removePath) {
    try {
      await api.removePath(folder);
    } catch (e) {
      void e;
    }
  } else if (api.deleteFile && api.readDir) {
    try {
      const files = await api.readDir(folder);
      for (const name of files) {
        try {
          await api.deleteFile(api.joinPath(folder, name));
        } catch (e) {
          void e;
        }
      }
    } catch (e) {
      void e;
    }
  }
}

/**
 * Write image bytes to appdata (`workspace/group-backgrounds/{groupId}/`) and return ref.
 */
export async function persistGroupBackgroundImage(
  groupId: string,
  image: string | null | undefined,
): Promise<string | null> {
  const id = String(groupId || '').trim();
  if (!id) return null;

  if (!image || !String(image).trim()) {
    await purgeGroupBackgroundFilesForGroup(id);
    return null;
  }

  const trimmed = String(image).trim();
  if (isGroupBackgroundRef(trimmed)) {
    return trimmed;
  }

  const api = electronApi();
  if (!api?.writeFileBinary || !api.joinPath) {
    return trimmed.startsWith('data:') ? trimmed : null;
  }

  await purgeGroupBackgroundFilesForGroup(id);
  invalidateGroupBackgroundDisplayCache(id);

  let base64 = '';
  let mime = 'image/jpeg';

  if (trimmed.startsWith('data:')) {
    const parsed = parseDataUrl(trimmed);
    if (!parsed?.base64) return null;
    base64 = parsed.base64;
    mime = parsed.mime;
  } else if (trimmed.startsWith('file:') && api.readFileBase64) {
    const filePath = fileUrlToPath(trimmed);
    try {
      const read = await api.readFileBase64(filePath);
      if (!read?.base64) return null;
      base64 = read.base64;
      mime = read.mime || 'image/jpeg';
    } catch (e) {
      logger.warn('[groupBackgroundStorage] read existing file failed', e);
      return null;
    }
  } else {
    return trimmed;
  }

  const root = await backgroundsRoot();
  if (!root) return trimmed.startsWith('data:') ? trimmed : null;

  const folder = groupBackgroundDir(root, id);
  await api.ensureDir(folder);
  const ext = mimeToExtension(mime);
  const filePath = api.joinPath(folder, `background${ext}`);
  try {
    await api.writeFileBinary(filePath, base64, mime);
    return `${GROUP_BG_REF_PREFIX}${id}`;
  } catch (e) {
    logger.error('[groupBackgroundStorage] write failed', filePath, e);
    return trimmed.startsWith('data:') ? trimmed : null;
  }
}

async function findGroupBackgroundFilePath(groupId: string): Promise<string | null> {
  const api = electronApi();
  const root = await backgroundsRoot();
  if (!api?.readDir || !api.joinPath || !root) return null;
  const folder = groupBackgroundDir(root, groupId);
  try {
    const files = await api.readDir(folder);
    const match = files.find((name) => name.startsWith('background.'));
    if (!match) return null;
    return api.joinPath(folder, match);
  } catch {
    return null;
  }
}

/**
 * Resolve stored ref to a data: URL for CSS (Electron blocks file:// in the renderer).
 */
export async function resolveGroupBackgroundDisplayUrl(
  raw: string | null | undefined,
): Promise<string | null> {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  if (v.startsWith('data:')) return v;

  if (isGroupBackgroundRef(v)) {
    const cached = displayDataUrlCache.get(v);
    if (cached) return cached;
    const gid = groupIdFromBackgroundRef(v);
    const filePath = await findGroupBackgroundFilePath(gid);
    if (!filePath) return null;
    const dataUrl = await filePathToDataUrl(filePath);
    if (dataUrl) displayDataUrlCache.set(v, dataUrl);
    return dataUrl;
  }

  if (v.startsWith('file:')) {
    return filePathToDataUrl(fileUrlToPath(v));
  }

  return v;
}

/** Read on-disk image as data URL for LAN sync outbound payload. */
export async function readGroupBackgroundForSync(
  raw: string | null | undefined,
): Promise<string | undefined> {
  if (!raw?.trim()) return undefined;
  const v = raw.trim();
  if (v.startsWith('data:')) return v;

  if (isGroupBackgroundRef(v)) {
    return (await resolveGroupBackgroundDisplayUrl(v)) ?? undefined;
  }

  if (v.startsWith('file:')) {
    return (await filePathToDataUrl(fileUrlToPath(v))) ?? undefined;
  }

  return undefined;
}

/** Strip inline image from group JSON; persist file under appdata when needed. */
export async function prepareGroupBackgroundForDisk(group: {
  id: string;
  backgroundImage?: string | null;
  background_image?: string | null;
}): Promise<void> {
  const raw = group.backgroundImage ?? group.background_image;
  const ref = await persistGroupBackgroundImage(String(group.id), raw ?? null);
  if (ref) {
    group.backgroundImage = ref;
    delete group.background_image;
  } else {
    delete group.backgroundImage;
    delete group.background_image;
    await purgeGroupBackgroundFilesForGroup(String(group.id));
  }
}

/** After LAN merge: persist inbound data URL to disk and store ref on the group. */
export async function adoptInboundGroupBackground(
  groupId: string,
  backgroundImage: string | null | undefined,
): Promise<string | null> {
  if (!backgroundImage?.trim()) {
    await purgeGroupBackgroundFilesForGroup(groupId);
    return null;
  }
  const v = backgroundImage.trim();
  if (isGroupBackgroundRef(v)) return v;
  if (v.startsWith('data:') || v.startsWith('file:')) {
    return persistGroupBackgroundImage(groupId, v);
  }
  return v;
}
