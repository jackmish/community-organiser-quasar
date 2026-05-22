import { appMainBg } from 'src/components/theme';
import { GROUP_DEFAULT_BACKGROUND } from 'src/modules/group/constants/groupPaletteColors';
import { hexToRgb } from 'src/utils/colorUtils';

export const DEFAULT_MONTH_BACKGROUND = '/images/months/bg_04.jpg';

/** Month JPEGs shipped in `public/images/months/` (add more as assets arrive). */
const SHIPPED_MONTH_BACKGROUNDS = new Set(['03', '04']);

/** Month background asset path (`01`–`12`). Uses shipped file or {@link DEFAULT_MONTH_BACKGROUND}. */
export function getMonthBackgroundUrl(month?: number): string {
  const m = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  const key = String(m).padStart(2, '0');
  if (SHIPPED_MONTH_BACKGROUNDS.has(key)) {
    return `/images/months/bg_${key}.jpg`;
  }
  return DEFAULT_MONTH_BACKGROUND;
}

export type GroupBackgroundState = {
  imageUrl: string | null;
  color: string;
  colorize: boolean;
  fallbackImageUrl: string;
};

export function readGroupBackgroundFields(group: Record<string, unknown> | null | undefined): {
  backgroundImage: string | null;
  backgroundColorize: boolean;
  color: string;
} {
  if (!group) {
    return {
      backgroundImage: null,
      backgroundColorize: false,
      color: GROUP_DEFAULT_BACKGROUND,
    };
  }
  const rawImg = group.backgroundImage ?? group.background_image;
  const backgroundImage =
    typeof rawImg === 'string' && rawImg.trim() ? rawImg.trim() : null;
  const backgroundColorize = Boolean(
    group.backgroundColorize ?? group.background_colorize,
  );
  const color =
    typeof group.color === 'string' && group.color ? group.color : GROUP_DEFAULT_BACKGROUND;
  return { backgroundImage, backgroundColorize, color };
}

export function resolveGroupBackground(
  group: Record<string, unknown> | null | undefined,
  month?: number,
): GroupBackgroundState {
  const { backgroundImage, backgroundColorize, color } = readGroupBackgroundFields(group);
  return {
    imageUrl: backgroundImage,
    color,
    colorize: backgroundColorize,
    fallbackImageUrl: getMonthBackgroundUrl(month),
  };
}

/** Hue in degrees 0–360 for #rrggbb. */
export function hexToHueDegrees(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  return (h / 6) * 360;
}

/**
 * CSS filter chain to tint a photo toward the group background color.
 * Works best on the default scenic backgrounds; custom photos get a color wash.
 */
export function colorizeFilterForHex(hex: string): string {
  const hue = hexToHueDegrees(hex);
  const rotate = Math.round(hue - 40);
  return `sepia(0.4) saturate(1.65) hue-rotate(${rotate}deg) brightness(0.92) contrast(1.08)`;
}

export function groupBackgroundLayerStyle(state: GroupBackgroundState): Record<string, string> {
  const useCustom = Boolean(state.imageUrl);
  const url = useCustom ? state.imageUrl! : state.fallbackImageUrl;
  const filter =
    useCustom && state.colorize ? colorizeFilterForHex(state.color) : 'none';
  return {
    backgroundColor: appMainBg,
    backgroundImage: `url("${url.replace(/"/g, '\\"')}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    filter,
  };
}
