import { describe, it, expect } from 'vitest';
import {
  colorizeFilterForHex,
  getMonthBackgroundUrl,
  groupBackgroundLayerStyle,
  hueRotateDegreesForTint,
  MONTH_FALLBACK_SOURCE_HUE,
  pageBackgroundAccentColor,
  resolveGroupBackground,
  sepiaStrengthForHex,
} from '../../src/modules/group/utils/groupBackground';

describe('groupBackground', () => {
  it('uses month fallback when group has no custom image', () => {
    const state = resolveGroupBackground({ id: 'g1', color: '#ffffff' }, 4);
    expect(state.imageUrl).toBeNull();
    expect(state.fallbackImageUrl).toBe('/images/months/bg_04.jpg');
    const style = groupBackgroundLayerStyle(state);
    expect(style.backgroundImage).toContain('bg_04.jpg');
    expect(style.filter).toBe('none');
    expect(style.backgroundColor).toBe('#def');
  });

  it('tints default background when colorize is enabled without custom image', () => {
    const state = resolveGroupBackground({
      id: 'g-test',
      color: '#e91e63',
      backgroundColorize: true,
    });
    const style = groupBackgroundLayerStyle(state);
    expect(style.filter).toContain('hue-rotate');
    expect(style.backgroundColor).not.toBe('#def');
  });

  it('does not tint custom image when colorize is off', () => {
    const state = resolveGroupBackground({
      id: 'g-test',
      backgroundImage: 'data:image/png;base64,abc',
      backgroundColorize: false,
      color: '#e91e63',
    });
    const style = groupBackgroundLayerStyle(state);
    expect(style.filter).toBe('none');
  });

  it('uses neutral accent when no group is active', () => {
    expect(pageBackgroundAccentColor(null)).toBe('#1976d2');
  });

  it('applies colorize filter when enabled with custom image', () => {
    const state = resolveGroupBackground({
      backgroundImage: 'data:image/png;base64,abc',
      backgroundColorize: true,
      color: '#e91e63',
    });
    const style = groupBackgroundLayerStyle(state);
    expect(style.backgroundImage).toContain('data:image');
    expect(style.filter).toContain('hue-rotate');
  });

  it('getMonthBackgroundUrl falls back when month asset is not shipped', () => {
    expect(getMonthBackgroundUrl(1)).toBe('/images/months/bg_04.jpg');
    expect(getMonthBackgroundUrl(4)).toBe('/images/months/bg_04.jpg');
    expect(getMonthBackgroundUrl(3)).toBe('/images/months/bg_03.jpg');
  });

  it('colorizeFilterForHex returns css filter', () => {
    expect(colorizeFilterForHex('#4caf50')).toMatch(/hue-rotate/);
  });

  it('does not overshoot blue group tint on month fallback (pink water)', () => {
    const hex = '#1976d2';
    const rotate = hueRotateDegreesForTint(hex, {
      sourceHue: MONTH_FALLBACK_SOURCE_HUE,
      sepiaStrength: sepiaStrengthForHex(hex),
    });
    expect(rotate).toBeGreaterThan(50);
    expect(rotate).toBeLessThan(110);
    expect(rotate).not.toBe(170);
  });

  it('uses low sepia and grayscale for white group color', () => {
    const filter = colorizeFilterForHex('#ffffff');
    expect(filter).toMatch(/sepia\(0\.0[0-9]/);
    expect(filter).toContain('grayscale(');
    expect(filter).not.toContain('hue-rotate');
  });

  it('uses low sepia and grayscale for black group color', () => {
    const filter = colorizeFilterForHex('#000000');
    expect(filter).toMatch(/sepia\(0\.0[0-9]/);
    expect(filter).toContain('grayscale(');
    expect(filter).not.toContain('hue-rotate');
  });

  it('uses stronger sepia and hue-rotate for saturated colors', () => {
    const filter = colorizeFilterForHex('#1976d2');
    expect(filter).toMatch(/sepia\(0\.[2-5]/);
    expect(filter).toContain('hue-rotate');
    expect(filter).toMatch(/saturate\(1\.[4-7]/);
  });

  it('desaturates muted blue-grey #607d8b toward the swatch', () => {
    const filter = colorizeFilterForHex('#607d8b');
    expect(filter).toContain('grayscale(');
    expect(filter).toContain('hue-rotate');
    const sat = filter.match(/saturate\(([\d.]+)\)/);
    expect(sat).not.toBeNull();
    expect(Number(sat![1])).toBeLessThan(1.05);
    expect(Number(sat![1])).toBeGreaterThan(0.7);
  });
});
