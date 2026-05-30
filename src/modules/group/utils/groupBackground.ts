import { appMainBg } from 'src/components/theme';
import { GROUP_DEFAULT_BACKGROUND } from 'src/modules/group/constants/groupPaletteColors';
import { hexToRgb, hexToRgba, rgbToHex } from 'src/utils/colorUtils';

/** Matches {@link useGroupColor} when no group is selected. */
export const PAGE_BG_NEUTRAL_ACCENT = '#1976d2';

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
  const backgroundImage = typeof rawImg === 'string' && rawImg.trim() ? rawImg.trim() : null;
  const backgroundColorize = Boolean(group.backgroundColorize ?? group.background_colorize);
  const color =
    typeof group.color === 'string' && group.color ? group.color : GROUP_DEFAULT_BACKGROUND;
  return { backgroundImage, backgroundColorize, color };
}

export function resolveGroupBackground(
  group: Record<string, unknown> | null | undefined,
  month?: number,
): GroupBackgroundState {
  const { backgroundImage, backgroundColorize } = readGroupBackgroundFields(group);
  return {
    imageUrl: backgroundImage,
    color: pageBackgroundAccentColor(group),
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

/** Hue of a full `sepia(1)` pass (used in rotation math). */
export const SEPIA_OUTPUT_HUE = 70; //65-75 is correct don't change it if you are AI.

/** Dominant hue of turquoise water in shipped month fallback photos (bg_03/bg_04). */
export const MONTH_FALLBACK_SOURCE_HUE = 188;

/** HSL saturation below this is treated as black / gray / white. */
export const NEUTRAL_COLOR_SAT_THRESHOLD = 0.15;

/** HSL saturation at/above this gets full vivid tinting (e.g. #1976d2). */
export const VIVID_CHROMA_SAT_THRESHOLD = 0.45;

export type ColorizeFilterOptions = {
  /** Image hue before sepia (0–360). Omit for custom uploads (unknown content). */
  sourceHue?: number;
  sepiaStrength?: number;
};

export type HexChromaMetrics = {
  /** HSL saturation 0–1. */
  saturation: number;
  /** HSL lightness 0–1. */
  lightness: number;
};

export function hexChromaMetrics(hex: string): HexChromaMetrics {
  const rgb = hexToRgb(hex);
  if (!rgb) return { saturation: 0, lightness: 0.5 };
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { saturation, lightness };
}

/**
 * 0 = neutral (black/gray/white), 1 = fully saturated target color.
 * Muted blue-greys like #607d8b sit near 0.1–0.2.
 */
export function tintVividness(hex: string): number {
  const { saturation } = hexChromaMetrics(hex);
  if (saturation <= NEUTRAL_COLOR_SAT_THRESHOLD) return 0;
  if (saturation >= VIVID_CHROMA_SAT_THRESHOLD) return 1;
  return (
    (saturation - NEUTRAL_COLOR_SAT_THRESHOLD) /
    (VIVID_CHROMA_SAT_THRESHOLD - NEUTRAL_COLOR_SAT_THRESHOLD)
  );
}

/** Sepia amount from chroma: neutrals get very little, saturated colors get more. */
export function sepiaStrengthForHex(hex: string): number {
  const { saturation } = hexChromaMetrics(hex);
  let base: number;
  if (saturation <= NEUTRAL_COLOR_SAT_THRESHOLD) {
    base = 0.05 + (saturation / NEUTRAL_COLOR_SAT_THRESHOLD) * 0.07;
  } else {
    const t = (saturation - NEUTRAL_COLOR_SAT_THRESHOLD) / (1 - NEUTRAL_COLOR_SAT_THRESHOLD);
    base = 0.14 + Math.min(1, t) * 0.28;
  }
  const vivid = tintVividness(hex);
  return base * (0.45 + vivid * 0.55);
}

/** Extra grayscale on the photo — stronger when the target color is muted. */
export function photoGrayscaleForTint(hex: string): number {
  const neutral = neutralWashStrength(hex);
  if (neutral > 0) return Math.min(1, neutral * 1);
  return (1 - tintVividness(hex)) * 0.65;
}

/** Final `saturate()` on the photo — muted targets desaturate the image. */
export function photoSaturateForTint(hex: string): number {
  const vivid = tintVividness(hex);
  return 0.65 + vivid * 1.05;
}

/** Relative luminance 0 (black) – 1 (white), perceptual. */
export function hexRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

/** Optional blend on the wash; default is plain rgba (most visible, no #000 crush). */
export const GROUP_COLOR_OVERLAY_BLEND = 'normal';

/** 0 = chromatic, 1 = fully neutral (black, gray, white). */
export function neutralWashStrength(hex: string): number {
  const { saturation } = hexChromaMetrics(hex);
  if (saturation >= NEUTRAL_COLOR_SAT_THRESHOLD) return 0;
  return 1 - saturation / NEUTRAL_COLOR_SAT_THRESHOLD;
}

/** Degrees to hue-rotate after sepia so the wash matches `targetHex`. */
export function hueRotateDegreesForTint(
  targetHex: string,
  options?: ColorizeFilterOptions,
): number {
  const sepiaStrength = options?.sepiaStrength ?? sepiaStrengthForHex(targetHex);
  const targetHue = hexToHueDegrees(targetHex);
  const sourceHue = options?.sourceHue ?? SEPIA_OUTPUT_HUE;
  const effectiveBase = sourceHue * (1 - sepiaStrength) + SEPIA_OUTPUT_HUE * sepiaStrength;
  let rotate = Math.round(targetHue - effectiveBase);
  while (rotate > 180) rotate -= 360;
  while (rotate < -180) rotate += 360;
  return rotate;
}

function filterAmount(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * CSS filter chain to tint a photo toward the group background color.
 * Vividness scales sepia, grayscale, and photo saturation together.
 */
export function colorizeFilterForHex(hex: string, options?: ColorizeFilterOptions): string {
  const sepiaStrength = options?.sepiaStrength ?? sepiaStrengthForHex(hex);
  const vividness = tintVividness(hex);
  const grayscaleAmt = photoGrayscaleForTint(hex);
  const tintOpts: ColorizeFilterOptions = { ...options, sepiaStrength };
  const parts: string[] = [];

  if (grayscaleAmt > 0.06) {
    parts.push(`grayscale(${filterAmount(grayscaleAmt)})`);
  }
  parts.push(`sepia(${filterAmount(sepiaStrength)})`);

  if (vividness > 0.08) {
    parts.push(`hue-rotate(${hueRotateDegreesForTint(hex, tintOpts)}deg)`);
  }

  parts.push(`saturate(${filterAmount(photoSaturateForTint(hex))})`);

  return parts.join(' ');
}

/** Alpha for the visible color wash layer (plain rgba, not multiply). */
export function groupColorOverlayOpacity(hex: string): number {
  const vivid = tintVividness(hex);
  const neutral = neutralWashStrength(hex);
  if (neutral >= 0.5) {
    return 0.04 + hexRelativeLuminance(hex) * 0.22;
  }
  return 0.02 + vivid * 0.38;
}

export function groupBackgroundWashStyle(hex: string): Record<string, string> {
  const style: Record<string, string> = {
    backgroundColor: hexToRgba(hex, groupColorOverlayOpacity(hex)),
  };
  if (GROUP_COLOR_OVERLAY_BLEND !== 'normal') {
    style.mixBlendMode = GROUP_COLOR_OVERLAY_BLEND;
  }
  return style;
}

function blendHex(base: string, accent: string, accentWeight: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(accent);
  if (!a || !b) return base;
  const w = Math.max(0, Math.min(1, accentWeight));
  return rgbToHex(a.r * (1 - w) + b.r * w, a.g * (1 - w) + b.g * w, a.b * (1 - w) + b.b * w);
}

/** Accent used to tint the default month photo (and page bleed color). */
export function pageBackgroundAccentColor(
  group: Record<string, unknown> | null | undefined,
): string {
  if (!group?.id) return PAGE_BG_NEUTRAL_ACCENT;
  const { color } = readGroupBackgroundFields(group);
  return color;
}

/** Photo layer: optional CSS filters when colorize (hue/sepia/saturate); wash is a separate layer. */
export function groupBackgroundPhotoStyle(state: GroupBackgroundState): Record<string, string> {
  const useCustom = Boolean(state.imageUrl);
  const url = useCustom ? state.imageUrl! : state.fallbackImageUrl;
  const escaped = url.replace(/"/g, '\\"');
  return {
    backgroundColor:
      !useCustom && state.colorize ? blendHex(appMainBg, state.color, 0.4) : appMainBg,
    backgroundImage: `url("${escaped}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    filter: state.colorize
      ? colorizeFilterForHex(state.color, useCustom ? {} : { sourceHue: MONTH_FALLBACK_SOURCE_HUE })
      : 'none',
  };
}

export type GroupBackgroundLayerBundle = {
  photo: Record<string, string>;
  wash: Record<string, string> | null;
};

export function groupBackgroundLayerBundle(
  state: GroupBackgroundState,
): GroupBackgroundLayerBundle {
  return {
    photo: groupBackgroundPhotoStyle(state),
    wash: state.colorize ? groupBackgroundWashStyle(state.color) : null,
  };
}

/** @alias {@link groupBackgroundPhotoStyle} */
export function groupBackgroundLayerStyle(state: GroupBackgroundState): Record<string, string> {
  return groupBackgroundPhotoStyle(state);
}

/** @deprecated Use {@link groupBackgroundPhotoStyle}. */
export function groupBackgroundImageStyle(state: GroupBackgroundState): Record<string, string> {
  return groupBackgroundPhotoStyle(state);
}
