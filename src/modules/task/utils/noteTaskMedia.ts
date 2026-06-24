import type { TaskAttachment } from 'src/modules/task/models/TaskModel';
import { getLocale } from 'src/modules/lang';
import { isNoteTaskType } from './calendarTaskTypes';

export type NoteTaskMediaSource =
  | {
      name?: string;
      description?: string;
      photo?: string;
      notePhoto?: string;
      attachments?: TaskAttachment[];
      noteAttachments?: TaskAttachment[];
      type_id?: string;
      type?: string;
    }
  | null
  | undefined;

export type NoteGraphicItem = {
  name: string;
  dataUrl: string;
  kind: 'photo' | 'attachment';
  attachmentIndex?: number;
};

const NOTE_DESCRIPTION_LONG_THRESHOLD = 160;
const NOTE_DESCRIPTION_MAX_NEWLINES = 2;

export function resolveTaskPhoto(task: NoteTaskMediaSource): string {
  if (!task) return '';
  const photo = task.photo ?? task.notePhoto;
  return typeof photo === 'string' ? photo : '';
}

function isTaskAttachment(item: unknown): item is TaskAttachment {
  if (item == null || typeof item !== 'object') return false;
  const record = item as Record<string, unknown>;
  return typeof record.name === 'string' && typeof record.dataUrl === 'string';
}

export function resolveTaskAttachments(task: NoteTaskMediaSource): TaskAttachment[] {
  if (!task) return [];
  const raw = task.attachments ?? task.noteAttachments;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isTaskAttachment);
}

export function countTaskAttachments(task: NoteTaskMediaSource): number {
  return resolveTaskAttachments(task).length;
}

export function firstImageTaskAttachment(task: NoteTaskMediaSource): TaskAttachment | null {
  for (const att of resolveTaskAttachments(task)) {
    if (isImageDataUrl(att.dataUrl)) return att;
  }
  return null;
}

type NoteCreatedAtSource = NoteTaskMediaSource & {
  createdAt?: string;
  created_at?: string;
};

/** Creation timestamp for note list cards (date + hour:minute, no relative labels). */
export function formatNoteTaskCreatedAt(task: NoteCreatedAtSource | null | undefined): string {
  if (!task) return '';
  const raw = task.createdAt ?? task.created_at;
  if (!raw) return '';
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function noteTaskListCaption(task: NoteCreatedAtSource | null | undefined): string {
  if (!isNoteTaskType(task)) return '';
  return formatNoteTaskCreatedAt(task);
}

export function isImageDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/');
}

export function stripTitleFromDescription(text = '', title = ''): string {
  if (!text || !title) return text;
  const t = title.trim();
  if (!t) return text;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `^\\s*${escaped}(?:\\s*[-:—\\|]+\\s*|\\s+|\\s*\\n\\s*)?`,
    'i',
  );
  return text.replace(pattern, '');
}

export function isLongNoteDescription(plainDescription: string): boolean {
  const text = plainDescription.trim();
  if (!text) return false;
  if (text.length > NOTE_DESCRIPTION_LONG_THRESHOLD) return true;
  return (text.match(/\n/g)?.length ?? 0) >= NOTE_DESCRIPTION_MAX_NEWLINES;
}

export function collectNoteGraphicItems(task: NoteTaskMediaSource): NoteGraphicItem[] {
  const items: NoteGraphicItem[] = [];
  const photo = resolveTaskPhoto(task);
  if (photo && isImageDataUrl(photo)) {
    items.push({ name: 'Photo', dataUrl: photo, kind: 'photo' });
  }
  resolveTaskAttachments(task).forEach((att, index) => {
    if (isImageDataUrl(att.dataUrl)) {
      items.push({
        name: att.name,
        dataUrl: att.dataUrl,
        kind: 'attachment',
        attachmentIndex: index,
      });
    }
  });
  return items;
}

export function shouldShowNoteGraphicHero(task: NoteTaskMediaSource): boolean {
  if (!isNoteTaskType(task)) return false;
  const attachments = resolveTaskAttachments(task);
  const nonGraphicCount = attachments.filter((a) => !isImageDataUrl(a.dataUrl)).length;
  if (nonGraphicCount > 0) return false;
  const graphics = collectNoteGraphicItems(task);
  if (graphics.length !== 1) return false;
  const photo = resolveTaskPhoto(task);
  if (photo && attachments.length > 0) return false;
  const plain = stripTitleFromDescription(
    String(task?.description || ''),
    String(task?.name || ''),
  );
  return !isLongNoteDescription(plain);
}
