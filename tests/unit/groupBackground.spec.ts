import { describe, it, expect } from 'vitest';
import {
  colorizeFilterForHex,
  getMonthBackgroundUrl,
  groupBackgroundLayerStyle,
  resolveGroupBackground,
} from '../../src/modules/group/utils/groupBackground';

describe('groupBackground', () => {
  it('uses month fallback when group has no custom image', () => {
    const state = resolveGroupBackground({ color: '#ffffff' }, 4);
    expect(state.imageUrl).toBeNull();
    expect(state.fallbackImageUrl).toBe('/images/months/bg_04.jpg');
    const style = groupBackgroundLayerStyle(state);
    expect(style.backgroundImage).toContain('bg_04.jpg');
    expect(style.filter).toBe('none');
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
