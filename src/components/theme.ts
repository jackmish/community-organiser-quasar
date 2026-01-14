import { format } from 'date-fns';

// Grouped priority definitions: each priority has a background and a preferred text color
export const priorityDefinitions: Record<string, { bg: string; text: string; icon?: string }> = {
  low: { bg: '#c7e3ef', text: '#263238', icon: 'low_priority' },
  medium: { bg: '#80deea', text: '#263238', icon: 'drag_handle' },
  high: { bg: '#ff9800', text: '#263238', icon: 'priority_high' },
  critical: { bg: '#f44336', text: '#ffffff', icon: 'warning' },
};

// Backwards-compatible simple map of priority -> background color
export const priorityColors: Record<string, string> = Object.fromEntries(
  Object.entries(priorityDefinitions).map(([k, v]) => [k, v.bg]),
) as Record<string, string>;

export const priorityTextColor = (p?: string) => {
  if (!p) return '#ffffff';
  return priorityDefinitions[p] ? priorityDefinitions[p].text : '#ffffff';
};

// Application main background color used for global styling
export const appMainBg = '#def';

export const timeDiffClassFor = (label: string) => {
  // Return semantic class names that the page can style for improved contrast
  if (!label) return 'time-diff-default';
  if (label === 'TODAY') return 'time-diff-white';
  if (label === 'TOMORROW') return 'time-diff-lightblue';
  return 'time-diff-default';
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
  // Backwards-compatible map derived from priorityDefinitions (icons moved into definitions)
  ...(Object.fromEntries(
    Object.entries(priorityDefinitions).map(([k, v]) => [k, (v as any).icon || '']),
  ) as Record<string, string>),
};

// Replenishment color sets used across components
export const replenishColorSets: Array<{ id: string; bg: string; text: string }> = [
  { id: 'set-1', bg: '#b71c1c', text: '#ffffff' },
  { id: 'set-4', bg: '#ff5252', text: '#000000' },
  { id: 'set-3', bg: '#ff8a80', text: '#000000' },
  { id: 'set-5', bg: '#fdd835', text: '#000000' },
  { id: 'set-8', bg: '#ffeb3b', text: '#000000' },
  { id: 'set-6', bg: '#fff176', text: '#000000' },
  { id: 'set-9', bg: '#2e7d32', text: '#ffffff' },
  { id: 'set-11', bg: '#9ccc65', text: '#000000' },
  { id: 'set-12', bg: '#a5d6a7', text: '#000000' },
  { id: 'set-13', bg: '#00acc1', text: '#ffffff' },
  { id: 'set-15', bg: '#80deea', text: '#000000' },
  { id: 'set-16', bg: '#b2ebf2', text: '#000000' },
  { id: 'set-17', bg: '#0d47a1', text: '#ffffff' },
  { id: 'set-18', bg: '#1976d2', text: '#ffffff' },
  { id: 'set-20', bg: '#90caf9', text: '#000000' },
  { id: 'set-21', bg: '#6a1b9a', text: '#ffffff' },
  { id: 'set-23', bg: '#ab47bc', text: '#ffffff' },
  { id: 'set-24', bg: '#ce93d8', text: '#000000' },
  { id: 'set-25', bg: '#000000', text: '#ffffff' },
  { id: 'set-27', bg: '#9e9e9e', text: '#000000' },
  { id: 'set-28', bg: '#ffffff', text: '#000000' },
];

export const findReplenishSet = (id?: string | null) => {
  if (!id) return null;
  return replenishColorSets.find((s) => s.id === id) || null;
};

export const getReplenishBg = (id?: string | null) => {
  const s = findReplenishSet(id);
  return s ? s.bg : 'transparent';
};

export const getReplenishText = (id?: string | null) => {
  const s = findReplenishSet(id);
  return s ? s.text : 'inherit';
};
