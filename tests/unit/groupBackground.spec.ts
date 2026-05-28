import { describe, it, expect } from 'vitest';
import {
  colorizeFilterForHex,
  getMonthBackgroundUrl,
  groupBackgroundLayerBundle,
  groupBackgroundLayerStyle,
  groupBackgroundWashStyle,
  groupColorOverlayOpacity,
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
    const bundle = groupBackgroundLayerBundle(state);
    expect(bundle.wash).not.toBeNull();
    expect(bundle.wash?.backgroundColor).toContain('rgba');
    expect(bundle.photo.filter).toContain('hue-rotate');
    expect(bundle.photo.backgroundImage).toContain('bg_04');
  });

  it('does not tint custom image when colorize is off', () => {
    const state = resolveGroupBackground({
      id: 'g-test',
      backgroundImage: 'data:image/png;base64,abc',
      backgroundColorize: false,
      color: '#e91e63',
    });
    const bundle = groupBackgroundLayerBundle(state);
    expect(bundle.wash).toBeNull();
    expect(bundle.photo.filter).toBe('none');
  });

  it('uses neutral accent when no group is active', () => {
    expect(pageBackgroundAccentColor(null)).toBe('#1976d2');
  });

  it('applies wash and photo filters when enabled with custom image', () => {
    const state = resolveGroupBackground({
      id: 'g-test',
      backgroundImage: 'data:image/png;base64,abc',
      backgroundColorize: true,
      color: '#e91e63',
    });
    const bundle = groupBackgroundLayerBundle(state);
    expect(bundle.photo.backgroundImage).toContain('data:image');
    expect(bundle.photo.filter).toContain('hue-rotate');
    expect(bundle.wash?.backgroundColor).toMatch(/rgba/i);
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

  it('wash layer uses rgba (not multiply gradient)', () => {
    const wash = groupBackgroundWashStyle('#4caf50');
    expect(wash.backgroundColor).toMatch(/^rgba\(/);
    expect(wash.mixBlendMode).toBeUndefined();
    expect(groupColorOverlayOpacity('#4caf50')).toBeGreaterThan(0.4);
  });

  it('white group wash is a visible light rgba layer', () => {
    const wash = groupBackgroundWashStyle('#ffffff');
    expect(wash.backgroundColor).toMatch(/rgba\(255,\s*255,\s*255/);
  });

  it('desaturates muted blue-grey #607d8b in filter helper', () => {
    const filter = colorizeFilterForHex('#607d8b');
    expect(filter).toContain('grayscale(');
    expect(filter).toContain('hue-rotate');
  });
});
