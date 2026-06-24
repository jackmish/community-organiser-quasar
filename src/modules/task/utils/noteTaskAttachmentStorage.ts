import { revealMediaPath } from 'src/modules/media/mediaFolderService';
import { APP_DATA_PATH_SEGMENTS, joinPathSegments } from 'src/modules/storage/appDataPaths';
import logger from 'src/utils/logger';

function electronApi() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined;
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  return { mime: match[1] || 'application/octet-stream', base64: match[2] || '' };
}

function mimeToExtension(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  if (m.includes('pdf')) return '.pdf';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  return '';
}

function sanitizeFileName(name: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'attachment';
  let out = '';
  for (const ch of trimmed) {
    const code = ch.charCodeAt(0);
    if (code < 32 || '<>:"/\\|?*'.includes(ch)) {
      out += '_';
    } else {
      out += ch;
    }
    if (out.length >= 180) break;
  }
  return out || 'attachment';
}

function ensureFileExtension(fileName: string, mime: string): string {
  const safe = sanitizeFileName(fileName);
  const dot = safe.lastIndexOf('.');
  if (dot > 0 && dot < safe.length - 1) return safe;
  const ext = mimeToExtension(mime);
  return ext ? `${safe}${ext}` : safe;
}

async function attachmentsRoot(): Promise<string | null> {
  const api = electronApi();
  if (!api?.getAppDataPath || !api.joinPath || !api.ensureDir) return null;
  const appData = await api.getAppDataPath();
  const dir = joinPathSegments(api.joinPath, appData, APP_DATA_PATH_SEGMENTS.attachments);
  await api.ensureDir(dir);
  return dir;
}

function taskAttachmentDir(root: string, groupId: string, taskId: string): string {
  const api = electronApi()!;
  return api.joinPath(root, String(groupId || 'ungrouped'), String(taskId || 'task'));
}

export type MaterializeNoteAttachmentPayload = {
  groupId: string;
  taskId: string;
  name: string;
  dataUrl: string;
  existingFilePath?: string;
};

export async function materializeNoteAttachmentFile(
  payload: MaterializeNoteAttachmentPayload,
): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
  const api = electronApi();
  if (!api?.writeFileBinary || !api.joinPath || !api.ensureDir || !api.fileExists) {
    return { ok: false, error: 'Note attachments are only available in the desktop app' };
  }

  const existing = String(payload.existingFilePath || '').trim();
  if (existing) {
    try {
      if (await api.fileExists(existing)) {
        return { ok: true, filePath: existing };
      }
    } catch (e) {
      logger.warn('[noteTaskAttachmentStorage] existing file check failed', existing, e);
    }
  }

  const parsed = parseDataUrl(payload.dataUrl);
  if (!parsed?.base64) {
    return { ok: false, error: 'Invalid attachment data' };
  }

  const root = await attachmentsRoot();
  if (!root) {
    return { ok: false, error: 'Could not resolve attachment storage folder' };
  }

  const folder = taskAttachmentDir(root, payload.groupId, payload.taskId);
  await api.ensureDir(folder);
  const fileName = ensureFileExtension(payload.name, parsed.mime);
  const filePath = api.joinPath(folder, fileName);
  try {
    await api.writeFileBinary(filePath, parsed.base64, parsed.mime);
    return { ok: true, filePath };
  } catch (e) {
    logger.error('[noteTaskAttachmentStorage] write failed', filePath, e);
    return { ok: false, error: 'Could not save attachment file' };
  }
}

export async function revealNoteAttachmentFile(
  payload: MaterializeNoteAttachmentPayload,
): Promise<{ ok: boolean; error?: string; filePath?: string }> {
  const materialized = await materializeNoteAttachmentFile(payload);
  if (!materialized.ok) {
    return { ok: false, error: materialized.error };
  }
  const revealed = await revealMediaPath(materialized.filePath);
  if (!revealed.ok) {
    return { ok: false, error: revealed.error || 'Could not open folder', filePath: materialized.filePath };
  }
  return { ok: true, filePath: materialized.filePath };
}
