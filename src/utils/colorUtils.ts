/**
 * Shared color utility functions used across components and composables.
 */

/** Parse a hex color string to {r,g,b} or null. Supports #rgb and #rrggbb. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const h = hex.replace(/^#/, '');
  const bigint = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  if (isNaN(bigint)) return null;
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/** Convert r,g,b integer values to a #rrggbb hex string. */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => {
        const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
        return s.length === 1 ? '0' + s : s;
      })
      .join('')
  );
}

/**
 * Convert a hex color to an `rgba(r, g, b, alpha)` CSS string.
 * @param hex  - Source hex color (#rgb or #rrggbb)
 * @param alpha - Opacity 0-1 (default 1)
 */
export function hexToRgba(hex: string, alpha = 1): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Darken a hex color by a given fractional amount (0–1).
 * @param hex    - Source hex color
 * @param amount - Fraction to darken (default 0.12 = 12%)
 */
export function darkenHex(hex: string, amount = 0.12): string {
  try {
    const rgb = hexToRgb(String(hex || '#1976d2'));
    if (!rgb) return hex;
    return rgbToHex(
      Math.round(rgb.r * (1 - amount)),
      Math.round(rgb.g * (1 - amount)),
      Math.round(rgb.b * (1 - amount)),
    );
  } catch {
    return hex;
  }
}

/** Lighten a hex color by blending toward white (amount 0–1). */
export function lightenHex(hex: string, amount = 0.12): string {
  try {
    const rgb = hexToRgb(String(hex || '#1976d2'));
    if (!rgb) return hex;
    const w = Math.max(0, Math.min(1, amount));
    return rgbToHex(
      Math.round(rgb.r + (255 - rgb.r) * w),
      Math.round(rgb.g + (255 - rgb.g) * w),
      Math.round(rgb.b + (255 - rgb.b) * w),
    );
  } catch {
    return hex;
  }
}

/** Blend two hex colors; `accentWeight` is the fraction of `accent`. */
export function blendHex(base: string, accent: string, accentWeight: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(accent);
  if (!a || !b) return base;
  const w = Math.max(0, Math.min(1, accentWeight));
  return rgbToHex(
    Math.round(a.r * (1 - w) + b.r * w),
    Math.round(a.g * (1 - w) + b.g * w),
    Math.round(a.b * (1 - w) + b.b * w),
  );
}

/** Relative luminance 0–1 (sRGB, same weights as contrast helpers). */
export function hexRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(String(hex || '#1976d2'));
  if (!rgb) return 0.5;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when the color reads as light on screen (default threshold ≈ getContrastColor flip). */
export function isHexBright(hex: string, threshold = 0.55): boolean {
  return hexRelativeLuminance(hex) > threshold;
}

/**
 * Return '#000' or '#fff' depending on which has better contrast against the given hex color.
 */
export function getContrastColor(hex: string): '#000' | '#fff' {
  try {
    return hexRelativeLuminance(hex) > 0.6 ? '#000' : '#fff';
  } catch {
    return '#000';
  }
}
