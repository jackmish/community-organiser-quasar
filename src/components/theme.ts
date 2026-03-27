// date helpers (formatDisplayDate, formatEventHoursDiff) are exported from
// the occursOnDay util to keep theme focused on styling/helpers only.

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

// Application main background color used for  global styling
export const appMainBg = '#def';

// Highlight/pin icon choices — can be changed globally here.
export const highlightIcon = 'flag';
export const highlightIconOutlined = 'push_pin_outlined';
export const highlightIconRounded = 'push_pin_rounded';

export const timeDiffClassFor = (label: string) => {
  // Return semantic class names that the page can style for improved contrast
  if (!label) return 'time-diff-default';
  if (label === 'TODAY') return 'time-diff-white';
  if (label === 'TOMORROW') return 'time-diff-lightblue';
  return 'time-diff-default';
};

// (moved) see occursOnDay util

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
  { id: 'set-0', bg: '#8B5E3C', text: '#ffffff' },
  { id: 'set-1', bg: '#b71c1c', text: '#ffffff' },
  { id: 'set-4', bg: '#ff5252', text: '#000000' },
  { id: 'set-14', bg: '#ff9800', text: '#000000' },
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
  { id: 'set-29', bg: '#efe6d6', text: '#000000' },
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

// Colors for task types (used across components)
export const typeColors: Record<string, string> = {
  TimeEvent: '#2196f3',
  Todo: '#4caf50',
  NoteLater: '#9e9e9e',
  Replenish: '#c9a676',
};

export const typeTextColors: Record<string, string> = {
  TimeEvent: 'white',
  Todo: 'white',
  NoteLater: 'white',
  Replenish: '#212121',
};

// Month color tokens (hex only). Keys are zero-padded month numbers e.g. '01'..'12'.
export const monthColors: Record<string, string> = {
  '01': '#90caf9',
  '02': '#f48fb1',
  '03': '#a5d6a7',
  '04': '#ffcc80',
  '05': '#ffd54f',
  '06': '#b39ddb',
  '07': '#ff8a65',
  '08': '#4db6ac',
  '09': '#aed581',
  '10': '#ffb74d',
  '11': '#81d4fa',
  '12': '#ce93d8',
};

// Overlay color chooser used for calendar overlays and jump-button alignment.
export function getOverlayColorForMonth(monthLike: string | number | Date): string {
  const overlayColorArray = [
    '#4caff0',

    '#25c6c7',
    '#ff9800',
    '#9c27b0',
    '#009688',
    '#e91e63',
    '#3f51b5',
  ];

  let monthNum: number;
  if (typeof monthLike === 'number') monthNum = monthLike;
  else if (monthLike instanceof Date) monthNum = monthLike.getMonth() + 1;
  else if (typeof monthLike === 'string') {
    const parsed = new Date(monthLike);
    if (!isNaN(parsed.getTime())) monthNum = parsed.getMonth() + 1;
    else {
      const n = Number(monthLike);
      monthNum = isNaN(n) ? 1 : n;
    }
  } else {
    const n = Number(String(monthLike));
    monthNum = isNaN(n) ? 1 : n;
  }

  const todayMonth = new Date().getMonth() + 1;
  const offset = (monthNum - todayMonth + 12) % 12;

  if (offset >= 0 && offset < overlayColorArray.length) {
    return overlayColorArray[offset] ?? overlayColorArray[0] ?? '#1976d2';
  }

  const key = String(monthNum).padStart(2, '0');
  return monthColors[key] ?? '#1976d2';
}
