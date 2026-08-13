export const ALLOWED_PATHS = new Set([
  'place/autocomplete/json',
  'place/details/json',
  'geocode/json',
  'directions/json',
]);

export function assertAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.has(path);
}
