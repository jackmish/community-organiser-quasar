// date helpers (formatDisplayDate, formatEventHoursDiff) are exported from
// the occursOnDay util to keep theme focused on styling/helpers only.

import {
  GROUP_DEFAULT_BACKGROUND,
  GROUP_DEFAULT_TEXT_COLOR,
} from 'src/modules/group/constants/groupPaletteColors';
import { readGroupBackgroundFields } from 'src/modules/group/utils/groupBackground';
import {
  blendHex,
  darkenHex,
  getContrastColor,
  hexToRgba,
  isHexBright,
  lightenHex,
} from 'src/utils/colorUtils';

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

// ── Task-list density settings ────────────────────────────────────────────────
// Upper inclusive bounds for each size tier (non-Replenish active tasks).
// large:  0 – 3  tasks → spacious cards with inline subtask preview
// medium: 4 – 6  tasks → default view
// small:  7 – 9+ tasks → compact view (currently same as default)
export const taskListSizeRanges: Readonly<{ large: number; medium: number; small: number }> = {
  large: 6,
  medium: 12,
  small: 18,
};

export function resolveTaskListSizeVariant(
  nonReplenishCount: number,
): 'large' | 'medium' | 'small' {
  if (nonReplenishCount <= taskListSizeRanges.large) return 'large';
  if (nonReplenishCount <= taskListSizeRanges.medium) return 'medium';
  return 'small';
}

// ── Calendar theming (month bands, chrome, neutrals, nav) ─────────────────────

export type CalendarThemeOptions = {
  colorize: boolean;
  groupColor: string;
  groupTextColor: string;
};

/** Top/bottom bars above and below the grid when calendar colorize is off. */
export const CALENDAR_CHROME_BG_DEFAULT = 'rgba(50, 200, 255, 0.5)';

const CALENDAR_PRIMARY = '#1976d2';

const LEGACY_MONTH_OVERLAY_STOPS: ReadonlyArray<readonly [string, string]> = [
  ['#ffffff', '#fff'],
  ['#4cafe0', '#000'],
  ['#9ff800', '#fff'],
  ['#ff9800', '#fff'],
  ['#9c27b0', '#fff'],
  ['#009688', '#fff'],
  ['#3f51b5', '#fff'],
];

/** First N months use toned group bg; later months morph toward group text color. */
export const CALENDAR_TONED_MONTH_COUNT = 3;

const CALENDAR_MONTH_TONE_STEP = 0.14;
const CALENDAR_MONTH_TONE_MAX = 0.72;
const CALENDAR_MONTHS_IN_YEAR = 12;

export function resolveCalendarTheme(
  group: Record<string, unknown> | null | undefined,
): CalendarThemeOptions {
  const { calendarColorize, color, textColor } = readGroupBackgroundFields(group);
  return {
    colorize: calendarColorize,
    groupColor: color,
    groupTextColor: textColor,
  };
}

export function parseCalendarMonthNumber(monthLike: string | number | Date): number {
  if (typeof monthLike === 'number') return monthLike;
  if (monthLike instanceof Date) return monthLike.getMonth() + 1;
  if (typeof monthLike === 'string') {
    const parsed = new Date(monthLike);
    if (!isNaN(parsed.getTime())) return parsed.getMonth() + 1;
    const n = Number(monthLike);
    return isNaN(n) ? 1 : n;
  }
  const n = Number(String(monthLike));
  return isNaN(n) ? 1 : n;
}

/** Months ahead of the current calendar month (0 = this month, 1 = next, …). */
export function monthOffsetFromToday(monthLike: string | number | Date): number {
  const monthNum = parseCalendarMonthNumber(monthLike);
  const todayMonth = new Date().getMonth() + 1;
  return (monthNum - todayMonth + 12) % 12;
}

/** Tone steps 0..2 from group bg (bright → darker, dark → lighter). */
export function calendarTonedMonthColor(groupHex: string, toneIndex: number): string {
  const idx = Math.max(0, Math.min(CALENDAR_TONED_MONTH_COUNT - 1, toneIndex));
  if (idx === 0) return groupHex;
  const amount = Math.min(CALENDAR_MONTH_TONE_MAX, idx * CALENDAR_MONTH_TONE_STEP);
  return isHexBright(groupHex) ? darkenHex(groupHex, amount) : lightenHex(groupHex, amount);
}

function groupMonthBandColor(groupHex: string, textHex: string, offset: number): string {
  if (offset < CALENDAR_TONED_MONTH_COUNT) {
    return calendarTonedMonthColor(groupHex, offset);
  }
  const anchor = calendarTonedMonthColor(groupHex, CALENDAR_TONED_MONTH_COUNT - 1);
  const morphSpan = CALENDAR_MONTHS_IN_YEAR - CALENDAR_TONED_MONTH_COUNT;
  const morphIndex = offset - CALENDAR_TONED_MONTH_COUNT;
  const t = morphSpan <= 1 ? 1 : morphIndex / (morphSpan - 1);
  return blendHex(anchor, textHex, Math.min(1, Math.max(0, t)));
}

/** Month band / jump-button / label colors: [background, foreground]. */
export function getOverlayColorForMonth(
  monthLike: string | number | Date,
  theme?: CalendarThemeOptions,
): [bg: string, color: string] {
  const monthNum = parseCalendarMonthNumber(monthLike);
  const offset = monthOffsetFromToday(monthLike);

  if (!theme?.colorize) {
    if (offset >= 0 && offset < LEGACY_MONTH_OVERLAY_STOPS.length) {
      const entry = LEGACY_MONTH_OVERLAY_STOPS[offset] ?? LEGACY_MONTH_OVERLAY_STOPS[0]!;
      return [entry[0], entry[1]];
    }
    const key = String(monthNum).padStart(2, '0');
    const bg = monthColors[key] ?? CALENDAR_PRIMARY;
    return [bg, getContrastColor(bg)];
  }

  const groupHex = theme.groupColor || GROUP_DEFAULT_BACKGROUND;
  const textHex = theme.groupTextColor || GROUP_DEFAULT_TEXT_COLOR;
  const bg = groupMonthBandColor(groupHex, textHex, offset);
  return [bg, getContrastColor(bg)];
}

export function getCalendarSeparatorColor(theme?: CalendarThemeOptions): string {
  if (!theme?.colorize) return CALENDAR_PRIMARY;
  return theme.groupColor || GROUP_DEFAULT_BACKGROUND;
}

export function calendarChromeBackground(theme: CalendarThemeOptions): string {
  const g = theme.groupColor || GROUP_DEFAULT_BACKGROUND;
  return hexToRgba(blendHex('#ffffff', g, 0.52), 0.78);
}

export function getCalendarChromeBarStyle(theme?: CalendarThemeOptions): Record<string, string> {
  if (!theme?.colorize) return {};
  return { backgroundColor: calendarChromeBackground(theme) };
}

/** Direct group color for prev/next nav and visible-days pagination control. */
export function getCalendarControlColors(
  theme?: CalendarThemeOptions,
): { backgroundColor: string; color: string } {
  if (!theme?.colorize) {
    return { backgroundColor: CALENDAR_PRIMARY, color: '#ffffff' };
  }
  const bg = theme.groupColor || GROUP_DEFAULT_BACKGROUND;
  return { backgroundColor: bg, color: getContrastColor(bg) };
}

/**
 * CSS variables for calendar neutrals (day cells, weekday headers, accents).
 * Empty when colorize is off — SCSS fallbacks apply.
 */
export function getCalendarCssVariables(theme?: CalendarThemeOptions): Record<string, string> {
  if (!theme?.colorize) return {};
  const g = theme.groupColor || GROUP_DEFAULT_BACKGROUND;
  const control = getCalendarControlColors(theme);
  const chromeBg = calendarChromeBackground(theme);
  return {
    '--cal-chrome-bg': chromeBg,
    '--cal-day-bg': hexToRgba(blendHex('#ffffff', g, 0.14), 0.92),
    '--cal-weekday-bg': hexToRgba(blendHex('#eeeeee', g, 0.2), 0.93),
    '--cal-weekday-alt-bg': hexToRgba(blendHex('#ffffff', g, 0.12), 0.93),
    '--cal-weekend-th-bg': blendHex('#55bbff', g, 0.28),
    '--cal-past-day-bg': hexToRgba(blendHex('#ffffff', g, 0.1), 0.82),
    '--cal-weekend-highlight': hexToRgba(g, 0.38),
    '--cal-today-column-bg': hexToRgba(g, 0.42),
    '--cal-accent': g,
    '--cal-nav-btn-bg': control.backgroundColor,
    '--cal-nav-btn-fg': control.color,
    '--cal-pagination-bg': control.backgroundColor,
    '--cal-pagination-fg': control.color,
  };
}
