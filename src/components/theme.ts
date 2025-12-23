import { format } from 'date-fns';

export const priorityColors: Record<string, string> = {
  low: '#c7e3ef',
  medium: '#80deea',
  high: '#ff9800',
  critical: '#f44336',
};

export const priorityTextColor = (p?: string) => {
  if (!p) return 'white';
  if (p === 'low' || p === 'medium') return 'grey-9';
  return 'white';
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
  const diffHours = (dt.getTime() - now.getTime()) / (1000 * 60 * 60);
  const sign = diffHours >= 0 ? 1 : -1;
  const abs = Math.abs(diffHours);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  let str = '';
  if (hours === 0) {
    str = `${minutes}m`;
  } else if (minutes === 0) {
    str = `${hours}h`;
  } else {
    str = `${hours}h ${minutes}m`;
  }
  return sign >= 0 ? `In ${str}` : `${str} ago`;
}
