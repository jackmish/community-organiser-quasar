import { formatAppMonthLong } from 'src/modules/lang/dateFormat';
import { MEDIA_TASK_TYPE } from 'src/modules/media/mediaTaskTypes';
import { parseYmdLocal } from 'src/utils/dateUtils';

/** Format a date as "d.MonthName" using the active app language. */
export function formatTaskTitleDate(dateStr: string): string {
  try {
    const parsed = parseYmdLocal(dateStr);
    if (!parsed) return dateStr;
    const day = parsed.getDate();
    const month = formatAppMonthLong(parsed);
    const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
    return `${day}.${monthCap}`;
  } catch {
    return dateStr;
  }
}

export type TaskNameFromDescriptionInput = {
  description?: string | null;
  eventDate?: string | null;
  date?: string | null;
  type_id?: string | null;
  timeMode?: string | null;
  /** Used when event date is not set yet (e.g. list-style descriptions). */
  fallbackDate?: string | null;
};

function resolveTypeLabel(typeId: string, timeMode: string): string {
  if (typeId === 'Todo') return 'Todo';
  if (typeId === 'Replenish') return 'Replenish';
  if (typeId === 'NoteLater') return 'Note';
  if (typeId === MEDIA_TASK_TYPE.Files) return 'Files';
  if (typeId === MEDIA_TASK_TYPE.Gallery) return 'Gallery';
  if (typeId === MEDIA_TASK_TYPE.Link) return 'Link';
  if (timeMode === 'prepare') return 'Preparation';
  if (timeMode === 'expiration') return 'Deadline';
  if (timeMode === 'holiday') return 'Holiday';
  return 'Event';
}

/** Same title rules as AddTaskForm auto-generated name. */
export function computeTaskNameFromDescription(input: TaskNameFromDescriptionInput): string {
  const desc = String(input.description ?? '').trim();
  if (!desc) return '';

  const dateStr = String(input.eventDate || input.date || input.fallbackDate || '').trim();

  if (/^-/.test(desc)) {
    const dateLabel = dateStr ? formatTaskTitleDate(dateStr) : '';
    const typeId = String(input.type_id || 'TimeEvent');
    const timeMode = String(input.timeMode || 'event');
    const typeLabel = resolveTypeLabel(typeId, timeMode);
    return (dateLabel ? `${dateLabel} ` : '') + typeLabel;
  }

  const newlineIndex = desc.indexOf('\n');
  let markerIndex = desc.indexOf(' -');
  if (newlineIndex >= 0 && (markerIndex === -1 || newlineIndex < markerIndex)) {
    markerIndex = newlineIndex;
  }
  let head = '';
  if (markerIndex > 0) {
    head = desc.substring(0, markerIndex).trim();
  } else {
    const firstSentence = desc.split(/[.!?]/)[0] || '';
    head = firstSentence || desc.substring(0, 50);
  }

  const name = head.length > 50 ? `${head.substring(0, 50)}...` : head;
  const cleaned = name.replace(/^[-*+]\s*/, '');
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
}
