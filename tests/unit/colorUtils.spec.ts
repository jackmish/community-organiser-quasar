import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  hexToRgba,
  darkenHex,
  getContrastColor,
} from '../../src/utils/colorUtils';

// ─── hexToRgb ─────────────────────────────────────────────────────────────────
describe('hexToRgb', () => {
  it('parses a #rrggbb hex string', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
  });

  it('parses a short #rgb hex string', () => {
    // #f80 → #ff8800
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('is case-insensitive', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('works without leading #', () => {
    expect(hexToRgb('0000ff')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('returns null for an empty string', () => {
    expect(hexToRgb('')).toBeNull();
  });

  it('returns null for an invalid hex string', () => {
    expect(hexToRgb('#zzzzzz')).toBeNull();
  });
});

// ─── rgbToHex ─────────────────────────────────────────────────────────────────
describe('rgbToHex', () => {
  it('converts r,g,b to a lowercase #rrggbb string', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
  });

  it('pads single-digit hex values', () => {
    expect(rgbToHex(0, 8, 16)).toBe('#000810');
  });

  it('clamps values outside 0–255', () => {
    expect(rgbToHex(-1, 256, 300)).toBe('#00ffff');
  });

  it('round-trips with hexToRgb', () => {
    const original = '#1976d2';
    const rgb = hexToRgb(original)!;
    expect(rgbToHex(rgb.r, rgb.g, rgb.b)).toBe(original);
  });
});

// ─── hexToRgba ────────────────────────────────────────────────────────────────
describe('hexToRgba', () => {
  it('produces an rgba() CSS string with the given alpha', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('defaults alpha to 1', () => {
    expect(hexToRgba('#00ff00')).toBe('rgba(0, 255, 0, 1)');
  });

  it('returns the original string when hex is invalid', () => {
    expect(hexToRgba('not-a-color', 0.5)).toBe('not-a-color');
  });
});

// ─── darkenHex ────────────────────────────────────────────────────────────────
describe('darkenHex', () => {
  it('darkens a color by 0% (amount=0) — same color returned', () => {
    expect(darkenHex('#ffffff', 0)).toBe('#ffffff');
  });

  it('darkens a color by 100% (amount=1) — returns black', () => {
    expect(darkenHex('#ffffff', 1)).toBe('#000000');
  });

  it('darkens a color by 50%', () => {
    const result = darkenHex('#ff0000', 0.5);
    const rgb = hexToRgb(result)!;
    expect(rgb.r).toBe(128);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it('falls back to darkening #1976d2 when input is empty', () => {
    // The implementation substitutes #1976d2 for empty/null input rather than returning early.
    const result = darkenHex('', 0.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    // Should be a darkened version of the fallback, not the empty string itself
    expect(result).not.toBe('');
  });
});

// ─── getContrastColor ─────────────────────────────────────────────────────────
describe('getContrastColor', () => {
  it('returns #fff for a dark background', () => {
    expect(getContrastColor('#000000')).toBe('#fff');
    expect(getContrastColor('#1976d2')).toBe('#fff');
    expect(getContrastColor('#333333')).toBe('#fff');
  });

  it('returns #000 for a light background', () => {
    expect(getContrastColor('#ffffff')).toBe('#000');
    expect(getContrastColor('#ffff00')).toBe('#000');
    expect(getContrastColor('#eeeeee')).toBe('#000');
  });

  it('falls back to contrasting against #1976d2 (dark blue) for empty input', () => {
    // Empty string causes the implementation to substitute #1976d2 (dark), result is #fff.
    expect(getContrastColor('')).toBe('#fff');
  });

  it('treats a 3-char string as a valid hex triplet', () => {
    // 'bad' is parsed as #bbaadd (light lavender), so contrast is #000.
    expect(getContrastColor('bad')).toBe('#000');
  });
});
