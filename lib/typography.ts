/**
 * Pure helpers behind the in-app text size setting. Kept free of React and
 * storage so the scale maths can be unit tested directly.
 */

export const FONT_SCALE_OPTIONS = [
  { id: 'default', label: 'Default', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.15 },
  { id: 'larger', label: 'Larger', scale: 1.3 },
  { id: 'largest', label: 'Largest', scale: 1.5 },
] as const;

export type FontScaleId = (typeof FONT_SCALE_OPTIONS)[number]['id'];

export const DEFAULT_FONT_SCALE_INDEX = 0;

/**
 * Resolves a stored scale back to a valid option index, snapping anything
 * unrecognised to the nearest step so a corrupted or hand-edited value can
 * never escape the scale set.
 */
export function normalizeFontScaleIndex(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_FONT_SCALE_INDEX;

  const exact = FONT_SCALE_OPTIONS.findIndex((o) => o.scale === n);
  if (exact !== -1) return exact;

  let closest = 0;
  for (let i = 1; i < FONT_SCALE_OPTIONS.length; i++) {
    if (
      Math.abs(FONT_SCALE_OPTIONS[i].scale - n) <
      Math.abs(FONT_SCALE_OPTIONS[closest].scale - n)
    ) {
      closest = i;
    }
  }
  return closest;
}

/** Clamps an index into range, rounding non-integers. */
export function clampFontScaleIndex(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_FONT_SCALE_INDEX;
  return Math.min(Math.max(Math.round(value), 0), FONT_SCALE_OPTIONS.length - 1);
}

// Any resolved style object: only these two keys are read, the rest is ignored.
type MaybeStyle = Readonly<Record<string, unknown>> | undefined;

/**
 * Builds the override applied on top of a resolved text style.
 *
 * `lineHeight` is scaled with `fontSize`: every style in the app that sets one
 * sets the other, and leaving the line box fixed would collapse it and overlap
 * the text. Returns undefined when there is nothing to scale, which lets the
 * caller pass the original style through untouched.
 */
export function scaleTextStyle(
  style: MaybeStyle,
  fontScale: number
): { fontSize?: number; lineHeight?: number } | undefined {
  if (fontScale === 1 || !style) return undefined;

  const out: { fontSize?: number; lineHeight?: number } = {};
  if (typeof style.fontSize === 'number') out.fontSize = style.fontSize * fontScale;
  if (typeof style.lineHeight === 'number') out.lineHeight = style.lineHeight * fontScale;

  return out.fontSize === undefined && out.lineHeight === undefined ? undefined : out;
}
