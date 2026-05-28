import { describe, it, expect } from 'vitest';
import {
  colorizeFilterForHex,
  getMonthBackgroundUrl,
  groupBackgroundLayerStyle,
  pageBackgroundAccentColor,
  resolveGroupBackground,
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
});
