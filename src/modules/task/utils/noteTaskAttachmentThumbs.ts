import { getMediaThumbnail } from 'src/modules/media/mediaFolderService';
import { fileModeThumbGenMaxEdge } from 'src/modules/media/mediaGalleryThumbSize';
import {
  materializeNoteAttachmentFile,
  type MaterializeNoteAttachmentPayload,
} from './noteTaskAttachmentStorage';
import { isImageDataUrl } from './noteTaskMedia';

export type NoteAttachmentThumbPayload = MaterializeNoteAttachmentPayload & {
  dataRoot?: string;
};

export type NoteAttachmentThumbResult =
  | { ok: true; url: string; filePath?: string }
  | { ok: false; error?: string };

async function resolveDataRoot(explicit?: string): Promise<string | null> {
  if (explicit?.trim()) return explicit.trim();
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.getAppDataPath) return null;
  try {
    return await api.getAppDataPath();
  } catch {
    return null;
  }
}

/** Materialize (if needed) and return a cached JPEG thumb URL, or fall back to the data URL. */
export async function getNoteAttachmentThumbUrl(
  payload: NoteAttachmentThumbPayload,
): Promise<NoteAttachmentThumbResult> {
  if (!isImageDataUrl(payload.dataUrl)) {
    return { ok: false, error: 'Not an image attachment' };
  }

  const dataRoot = await resolveDataRoot(payload.dataRoot);

  if (!dataRoot) {
    return { ok: true, url: payload.dataUrl };
  }

  const materialized = await materializeNoteAttachmentFile(payload);
  if (!materialized.ok) {
    return { ok: true, url: payload.dataUrl };
  }

  const thumb = await getMediaThumbnail(
    dataRoot,
    materialized.filePath,
    null,
    fileModeThumbGenMaxEdge(),
  );

  if (thumb.ok && thumb.url) {
    return { ok: true, url: thumb.url, filePath: materialized.filePath };
  }

  return { ok: true, url: payload.dataUrl, filePath: materialized.filePath };
}
