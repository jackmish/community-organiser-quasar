import { format } from 'date-fns';

export const priorityColors: Record<string, string> = {
  low: '#c7e3ef',
  medium: '#80deea',
  high: '#ff9800',
  critical: '#f44336',
};

export const priorityTextColor = (p?: string) => {
  // Return actual CSS color values for use in inline styles.
  if (!p) return '#ffffff';
  if (p === 'low' || p === 'medium') return '#263238'; // dark grey for contrast on light backgrounds
  return '#ffffff';
};

export const timeDiffClassFor = (label: string) => {
  if (!label) return 'text-grey-7';
  if (label === 'TODAY') return 'text-primary';
  if (label === 'TOMORROW') return 'text-positive';
  return 'text-grey-7';
};

export function formatDisplayDate(date: string) {
  try {
    return format(new Date(date), 'EEEE, dd.MM.yyyy');
  } catch (e) {
    return date || '';
  }
}

export function formatEventHoursDiff(dateStr: string, timeStr: string, now = new Date()) {
  if (!dateStr || !timeStr) return '';
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  if (isNaN(dt.getTime())) return '';
  const diffMinutes = Math.round((dt.getTime() - now.getTime()) / (1000 * 60));
  const sign = diffMinutes >= 0 ? 1 : -1;
  const absMinutes = Math.abs(diffMinutes);
  const days = Math.floor(absMinutes / (60 * 24));
  const remAfterDays = absMinutes - days * 24 * 60;
  const hours = Math.floor(remAfterDays / 60);
  const minutes = remAfterDays % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  const str = parts.join(' ');
  return sign >= 0 ? `In ${str}` : `${str} ago`;
}

// Shared icon mappings for task types and priorities
export const typeIcons: Record<string, string> = {
  TimeEvent: 'event',
  Todo: 'check_box',
  Replenish: 'autorenew',
  NoteLater: 'description',
};

export const priorityIcons: Record<string, string> = {
  critical: 'warning',
  high: 'priority_high',
  medium: 'drag_handle',
  low: 'low_priority',
};
