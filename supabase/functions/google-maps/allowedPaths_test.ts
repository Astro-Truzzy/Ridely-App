import { assertEquals } from 'jsr:@std/assert@1';
import { assertAllowedPath } from './allowedPaths.ts';

Deno.test('allows known Maps web-service paths', () => {
  assertEquals(assertAllowedPath('directions/json'), true);
  assertEquals(assertAllowedPath('geocode/json'), true);
  assertEquals(assertAllowedPath('place/autocomplete/json'), true);
  assertEquals(assertAllowedPath('place/details/json'), true);
});

Deno.test('rejects unknown paths', () => {
  assertEquals(assertAllowedPath('place/nearbysearch/json'), false);
  assertEquals(assertAllowedPath('../evil'), false);
  assertEquals(assertAllowedPath(''), false);
});
