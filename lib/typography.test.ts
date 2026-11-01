/// <reference types="jest" />
import {
  FONT_SCALE_OPTIONS,
  DEFAULT_FONT_SCALE_INDEX,
  normalizeFontScaleIndex,
  clampFontScaleIndex,
  scaleTextStyle,
} from './typography';

describe('normalizeFontScaleIndex', () => {
  it('round-trips every stored scale', () => {
    FONT_SCALE_OPTIONS.forEach((option, index) => {
      expect(normalizeFontScaleIndex(String(option.scale))).toBe(index);
      expect(normalizeFontScaleIndex(option.scale)).toBe(index);
    });
  });

  it('falls back to the default for unusable values', () => {
    [null, undefined, '', 'abc', {}, NaN, Infinity, -Infinity, true].forEach((bad) => {
      expect(normalizeFontScaleIndex(bad)).toBe(DEFAULT_FONT_SCALE_INDEX);
    });
  });

  it('snaps unknown numbers to the nearest step', () => {
    expect(normalizeFontScaleIndex(1.2)).toBe(1); // between Large and Larger
    expect(normalizeFontScaleIndex(1.45)).toBe(3); // nearest Largest
    expect(normalizeFontScaleIndex(0.5)).toBe(0);
  });
});

describe('clampFontScaleIndex', () => {
  it('keeps indexes in range', () => {
    expect(clampFontScaleIndex(-3)).toBe(0);
    expect(clampFontScaleIndex(99)).toBe(FONT_SCALE_OPTIONS.length - 1);
    expect(clampFontScaleIndex(2)).toBe(2);
  });

  it('rounds and rejects non-numbers', () => {
    expect(clampFontScaleIndex(1.6)).toBe(2);
    expect(clampFontScaleIndex(NaN)).toBe(DEFAULT_FONT_SCALE_INDEX);
  });
});

describe('scaleTextStyle', () => {
  it('does nothing at the default scale', () => {
    expect(scaleTextStyle({ fontSize: 16, lineHeight: 24 }, 1)).toBeUndefined();
  });

  it('scales font size and line height together', () => {
    expect(scaleTextStyle({ fontSize: 16, lineHeight: 24 }, 1.5)).toEqual({
      fontSize: 24,
      lineHeight: 36,
    });
  });

  it('scales each property independently when only one is set', () => {
    expect(scaleTextStyle({ fontSize: 14 }, 1.3)).toEqual({ fontSize: 18.2 });
    expect(scaleTextStyle({ lineHeight: 20 }, 1.15)).toEqual({ lineHeight: 23 });
  });

  it('leaves styles with no text size untouched so nested Text inherits', () => {
    expect(scaleTextStyle({}, 1.5)).toBeUndefined();
    expect(scaleTextStyle({ color: '#fff' }, 1.5)).toBeUndefined();
    expect(scaleTextStyle(undefined, 1.5)).toBeUndefined();
  });

  it('ignores non-numeric sizes', () => {
    expect(scaleTextStyle({ fontSize: '16', lineHeight: 24 }, 1.5)).toEqual({ lineHeight: 36 });
  });
});
