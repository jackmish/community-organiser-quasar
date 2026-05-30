// date helpers (formatDisplayDate, formatEventHoursDiff) are exported from
// the occursOnDay util to keep theme focused on styling/helpers only.

import {
  GROUP_DEFAULT_BACKGROUND,
  GROUP_DEFAULT_TEXT_COLOR,
} from 'src/modules/group/constants/groupPaletteColors';
import {
  isGroupBackgroundColorizeActive,
  isGroupCalendarColorizeActive,
  readGroupBackgroundFields,
  hexRelativeLuminance as groupHexRelativeLuminance,
} from 'src/modules/group/utils/groupBackground';
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

/** Two band tones when calendar colorize is on (even / odd month offset). */
export type CalendarColorizeTones = {
  /** Offsets 0, 2, 4, … */
  bright: string;
  /** Offsets 1, 3, 5, … */
  alternate: string;
};

export type CalendarThemeOptions = {
  colorize: boolean;
  groupColor: string;
  groupTextColor: string;
  colorizeTones: CalendarColorizeTones | null;
};

/** Lighten/darken amount for the alternate month band. */
export const CALENDAR_COLORIZE_ALTERNATE_STEP = 0.24;

/** Top/bottom bars above and below the grid when calendar colorize is off. */
export const CALENDAR_CHROME_BG_DEFAULT = 'rgba(50, 200, 255, 0.5)';

const CALENDAR_PRIMARY = '#1976d2';

const LEGACY_MONTH_OVERLAY_STOPS: ReadonlyArray<readonly [string, string]> = [
  ['#ffffff', '#fff'],
  ['#4cafe0', '#000'],
  ['#9ff800', '#000'],
  ['#ff9800', '#fff'],
  ['#9c27b0', '#fff'],
  ['#009688', '#fff'],
  ['#3f51b5', '#fff'],
];

/** Bright + alternate band colors from the group background color. */
export function buildCalendarColorizeTones(groupHex: string): CalendarColorizeTones {
  const g = (groupHex || '').trim() || GROUP_DEFAULT_BACKGROUND;
  const bright = g;
  const alternate = isHexBright(g)
    ? darkenHex(g, CALENDAR_COLORIZE_ALTERNATE_STEP)
    : lightenHex(g, CALENDAR_COLORIZE_ALTERNATE_STEP * 1.4);
  return { bright, alternate };
}

export function calendarBandColorForOffset(offset: number, tones: CalendarColorizeTones): string {
  return offset % 2 === 0 ? tones.bright : tones.alternate;
}

export function resolveCalendarTheme(
  group: Record<string, unknown> | null | undefined,
): CalendarThemeOptions {
  const { color, textColor } = readGroupBackgroundFields(group);
  const colorize = isGroupCalendarColorizeActive(group);
  return {
    colorize,
    groupColor: color,
    groupTextColor: textColor,
    colorizeTones: colorize ? buildCalendarColorizeTones(color) : null,
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

  const tones =
    theme.colorizeTones ?? buildCalendarColorizeTones(theme.groupColor || GROUP_DEFAULT_BACKGROUND);
  const bg = calendarBandColorForOffset(offset, tones);
  return [bg, getContrastColor(bg)];
}

export function calendarChromeBackground(theme: CalendarThemeOptions): string {
  const g = theme.groupColor || GROUP_DEFAULT_BACKGROUND;
  return hexToRgba(blendHex('#ffffff', g, 0.52), 0.78);
}

export function getCalendarChromeBarStyle(theme?: CalendarThemeOptions): Record<string, string> {
  if (!theme?.colorize) return {};
  return { backgroundColor: calendarChromeBackground(theme) };
}

/** Group color for today / prev / next / pagination controls when colorize is on. */
export function getCalendarControlColors(theme?: CalendarThemeOptions): {
  backgroundColor: string;
  color: string;
} {
  if (!theme?.colorize) {
    return { backgroundColor: CALENDAR_PRIMARY, color: '#ffffff' };
  }
  const g = theme.groupColor || GROUP_DEFAULT_BACKGROUND;
  return { backgroundColor: g, color: getContrastColor(g) };
}

/** Weekday `th` (Mon–Fri) background tint toward group color. */
const CALENDAR_WEEKDAY_TH_TINT = 0.52;

/** Weekend / holiday cell wash over day background. */
const CALENDAR_WEEKEND_HIGHLIGHT_ALPHA = 0.34;

function calendarGridCssVariables(theme: CalendarThemeOptions): Record<string, string> {
  const g = theme.groupColor || GROUP_DEFAULT_BACKGROUND;
  const groupText = theme.groupTextColor || getContrastColor(g);
  const tones = theme.colorizeTones ?? buildCalendarColorizeTones(g);
  return {
    '--cal-weekday-bg': hexToRgba(
      blendHex('#eeeeee', tones.bright, CALENDAR_WEEKDAY_TH_TINT),
      0.96,
    ),
    '--cal-weekday-alt-bg': hexToRgba(
      blendHex('#f7f7f7', tones.alternate, CALENDAR_WEEKDAY_TH_TINT),
      0.96,
    ),
    '--cal-weekend-th-bg': g,
    '--cal-weekend-th-fg': getContrastColor(g),
    '--cal-weekend-highlight': hexToRgba(g, CALENDAR_WEEKEND_HIGHLIGHT_ALPHA),
    '--cal-today-column-bg': hexToRgba(g, 0.28),
    '--cal-day-bg': 'rgba(255, 255, 255, 0.92)',
    '--cal-past-day-bg': 'rgba(255, 255, 255, 0.82)',
    '--cal-selected-bg': g,
    '--cal-selected-fg': getContrastColor(g),
    '--cal-selected-day-fg': groupText,
  };
}

export function getCalendarCssVariables(theme?: CalendarThemeOptions): Record<string, string> {
  if (!theme?.colorize) return {};
  const control = getCalendarControlColors(theme);
  const chromeBg = calendarChromeBackground(theme);
  return {
    '--cal-chrome-bg': chromeBg,
    '--cal-nav-btn-bg': control.backgroundColor,
    '--cal-nav-btn-fg': control.color,
    '--cal-pagination-bg': control.backgroundColor,
    '--cal-pagination-fg': control.color,
    ...calendarGridCssVariables(theme),
  };
}

// ── Shared surface / field / menu theming (use-default q-select & q-menu) ─────

/** Input for auto-derived `--co21-field-*` and `--co21-menu-*` CSS variables. */
export type Co21SurfaceThemeInput = {
  /** Primary accent hex (group color, panel brand color, …). */
  baseHex: string;
  /** Foreground on the panel surface; not applied to field/menu (those auto-contrast their fill). */
  textHex?: string;
  /** Actual panel fill hex when it differs from `co21SurfaceHex(baseHex)` (e.g. default meteo panel). */
  panelHex?: string;
};

const CO21_SURFACE_DARKEN = 0.1;
/** Field inset — always darker than the panel surface. */
const CO21_FIELD_DARKEN = 0.16;
const CO21_FIELD_DARKEN_BRIGHT = 0.24;
const CO21_MENU_HOVER_SHIFT = 0.1;
const CO21_MENU_ACTIVE_SHIFT = 0.17;

/** Solid field fill — darker inset against the panel (both bright and dark panels). */
function co21FieldBackgroundHex(input: Co21SurfaceThemeInput): string {
  const panel = co21PanelHex(input);
  const amount = isHexBright(panel) ? CO21_FIELD_DARKEN_BRIGHT : CO21_FIELD_DARKEN;
  return darkenHex(panel, amount);
}

/** Popup list — lifted from panel, always brighter than the dark field inset. */
function co21MenuBackgroundHex(input: Co21SurfaceThemeInput): string {
  const panel = co21PanelHex(input);
  const fieldBg = co21FieldBackgroundHex(input);
  const fieldL = groupHexRelativeLuminance(fieldBg);
  const targetL = fieldL + 0.12;

  for (const lift of [0.14, 0.22, 0.3, 0.38, 0.46]) {
    const candidate = lightenHex(panel, lift);
    if (groupHexRelativeLuminance(candidate) >= targetL) {
      return candidate;
    }
  }
  return lightenHex(panel, 0.5);
}

/** Hover / active row fill — shift menu bg (lighten when dark, darken when bright). */
function co21MenuStateBackgroundHex(menuBg: string, level: 'hover' | 'active'): string {
  const shift = level === 'hover' ? CO21_MENU_HOVER_SHIFT : CO21_MENU_ACTIVE_SHIFT;
  return isHexBright(menuBg) ? darkenHex(menuBg, shift) : lightenHex(menuBg, shift);
}

function co21SurfaceHex(baseHex: string): string {
  return darkenHex(baseHex, CO21_SURFACE_DARKEN);
}

function co21PanelHex(input: Co21SurfaceThemeInput): string {
  return (input.panelHex || co21SurfaceHex(input.baseHex)).trim();
}

function co21AccentHex(input: Co21SurfaceThemeInput): string {
  return (input.baseHex || GROUP_DEFAULT_BACKGROUND).trim();
}

function co21SurfaceFg(input: Co21SurfaceThemeInput): string {
  return co21ReadableFg(co21PanelHex(input), input.textHex);
}

/** WCAG contrast ratio between two sRGB hex colors. */
function co21ContrastRatio(fgHex: string, bgHex: string): number {
  const lFg = groupHexRelativeLuminance(fgHex);
  const lBg = groupHexRelativeLuminance(bgHex);
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Use preferred text (e.g. group textColor) only when readable on `bgHex`.
 * Field/menu surfaces must call `getContrastColor` on their own fill instead.
 */
function co21ReadableFg(bgHex: string, preferredFg?: string): string {
  const auto = getContrastColor(bgHex);
  const pref = preferredFg?.trim();
  if (!pref) return auto;
  return co21ContrastRatio(pref, bgHex) >= 4.5 ? pref : auto;
}

/** Best #000 / #fff for `bgHex` (never uses group textColor). */
function co21AutoFgOnBg(bgHex: string): '#000' | '#fff' {
  const black = co21ContrastRatio('#000000', bgHex);
  const white = co21ContrastRatio('#ffffff', bgHex);
  return white > black ? '#fff' : '#000';
}

export type Co21MenuThemeTokens = {
  menuBg: string;
  menuFg: string;
  menuHover: string;
  menuActive: string;
};

export type Co21FieldThemeTokens = {
  fieldBg: string;
  fieldFg: string;
};

/** Resolved field colors — fg is auto-contrast on field bg, not group textColor. */
export function resolveCo21FieldTheme(input: Co21SurfaceThemeInput): Co21FieldThemeTokens {
  const fieldBg = co21FieldBackgroundHex(input);
  return { fieldBg, fieldFg: co21AutoFgOnBg(fieldBg) };
}

/** Build surface theme input from an active group colorize config. */
export function buildCo21SurfaceThemeInputFromGroup(
  group: Record<string, unknown> | null | undefined,
): Co21SurfaceThemeInput | null {
  if (!isGroupBackgroundColorizeActive(group)) return null;
  const { color, textColor } = readGroupBackgroundFields(group);
  const accent = color.trim() || GROUP_DEFAULT_BACKGROUND;
  return {
    baseHex: accent,
    textHex: textColor.trim() || getContrastColor(accent),
    panelHex: co21SurfaceHex(accent),
  };
}

/** Resolved menu colors — fg is auto-contrast on menu bg, not group textColor. */
export function resolveCo21MenuTheme(input: Co21SurfaceThemeInput): Co21MenuThemeTokens {
  const menuBg = co21MenuBackgroundHex(input);
  return {
    menuBg,
    menuFg: co21AutoFgOnBg(menuBg),
    menuHover: co21MenuStateBackgroundHex(menuBg, 'hover'),
    menuActive: co21MenuStateBackgroundHex(menuBg, 'active'),
  };
}

/** Outlined field tokens for `q-select.use-default` — bind on the q-select via `:style`. */
export function getCo21FieldCssVariables(input: Co21SurfaceThemeInput): Record<string, string> {
  const { fieldBg, fieldFg } = resolveCo21FieldTheme(input);
  return {
    '--co21-field-fg': fieldFg,
    '--co21-field-bg': fieldBg,
    '--co21-field-border': hexToRgba(fieldFg, 0.38),
    '--co21-field-border-focus': hexToRgba(fieldFg, 0.62),
    '--co21-field-placeholder': hexToRgba(fieldFg, 0.58),
  };
}

/** Dropdown / menu tokens for `q-menu.use-default` — bind via `popup-content-style`. */
export function getCo21MenuCssVariables(input: Co21SurfaceThemeInput): Record<string, string> {
  const { menuBg, menuFg, menuHover, menuActive } = resolveCo21MenuTheme(input);
  return {
    '--co21-menu-bg': menuBg,
    '--co21-menu-fg': menuFg,
    '--co21-menu-placeholder': hexToRgba(menuFg, 0.58),
    '--co21-menu-hover': menuHover,
    '--co21-menu-active': menuActive,
  };
}

/** Popup style object for `:popup-content-style` (object form). */
export function getCo21MenuPopupStyle(input: Co21SurfaceThemeInput): Record<string, string> {
  const { menuBg, menuFg } = resolveCo21MenuTheme(input);
  const vars = getCo21MenuCssVariables(input);
  return {
    ...vars,
    background: menuBg,
    backgroundColor: menuBg,
    color: menuFg,
  };
}

/**
 * Inline CSS string for `:popup-content-style` — Quasar teleports the menu and applies this
 * as the root `style` attribute (more reliable than CSS vars alone on the popup node).
 */
export function getCo21MenuPopupStyleInline(input: Co21SurfaceThemeInput): string {
  const { menuBg, menuFg } = resolveCo21MenuTheme(input);
  const vars = getCo21MenuCssVariables(input);
  const parts = [
    ...Object.entries(vars).map(([key, value]) => `${key}:${value}`),
    `background:${menuBg} !important`,
    `background-color:${menuBg} !important`,
    `color:${menuFg} !important`,
  ];
  return parts.join(';');
}

const CO21_MENU_POPUP_SELECTORS = [
  '.q-menu.co21-themed-menu',
  '.q-menu.use-default.co21-themed-menu',
  '.co21-themed-menu',
  '.q-select__dialog .co21-themed-menu',
].join(',');

function applyCo21MenuPopupThemeToElement(el: HTMLElement, style: Record<string, string>): void {
  Object.entries(style).forEach(([key, value]) => {
    if (key.startsWith('--')) {
      el.style.setProperty(key, value);
    } else if (key === 'background' || key === 'backgroundColor') {
      el.style.setProperty('background-color', value, 'important');
      el.style.setProperty('background', value, 'important');
    } else if (key === 'color') {
      el.style.setProperty('color', value, 'important');
    }
  });
}

/**
 * Apply menu theme tokens on teleported popup nodes (menu or dialog-inner scroll div).
 * Returns true when at least one node was styled.
 */
export function pinCo21MenuPopupTheme(
  input: Co21SurfaceThemeInput,
  scope: ParentNode = document,
): boolean {
  if (typeof document === 'undefined') return false;
  const style = getCo21MenuPopupStyle(input);
  const nodes = scope.querySelectorAll(CO21_MENU_POPUP_SELECTORS);
  if (nodes.length === 0) return false;
  nodes.forEach((node) => applyCo21MenuPopupThemeToElement(node as HTMLElement, style));
  return true;
}

/** Retry until the teleported popup exists (popup-show fires before the node mounts). */
export function pinCo21MenuPopupThemeWhenReady(input: Co21SurfaceThemeInput): void {
  if (typeof document === 'undefined') return;
  if (pinCo21MenuPopupTheme(input)) return;
  let attempts = 0;
  const tryPin = () => {
    if (pinCo21MenuPopupTheme(input) || attempts >= 24) return;
    attempts += 1;
    requestAnimationFrame(tryPin);
  };
  requestAnimationFrame(tryPin);
}

/** Field + menu tokens together (e.g. non-teleported menus). */
export function getCo21SurfaceCssVariables(input: Co21SurfaceThemeInput): Record<string, string> {
  return {
    ...getCo21FieldCssVariables(input),
    ...getCo21MenuCssVariables(input),
  };
}

/** Panel/card background from the same accent as field/menu tokens. */
export function getCo21SurfaceBackgroundStyle(input: Co21SurfaceThemeInput): Record<string, string> {
  return {
    backgroundColor: hexToRgba(co21PanelHex(input), 0.9),
    color: co21SurfaceFg(input),
  };
}
