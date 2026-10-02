import { extendTrail } from './useRiderTrail';

// ~0.0001° latitude ≈ 11 m.
const at = (dLat: number) => ({ latitude: 6.5 + dLat, longitude: 3.4 });

describe('extendTrail', () => {
  it('starts a trail from the first position', () => {
    expect(extendTrail([], at(0))).toEqual([at(0)]);
  });

  it('appends real movement', () => {
    expect(extendTrail([at(0)], at(0.0005))).toHaveLength(2);
  });

  it('ignores GPS jitter under a few metres', () => {
    const trail = [at(0)];
    expect(extendTrail(trail, at(0.00003))).toBe(trail);
  });

  it('restarts after an implausible jump instead of drawing a straight line', () => {
    expect(extendTrail([at(0), at(0.001)], at(0.5))).toEqual([at(0.5)]);
  });

  it('caps the trail length', () => {
    let trail = [at(0)];
    for (let i = 1; i <= 600; i++) trail = extendTrail(trail, at(i * 0.0005));
    expect(trail).toHaveLength(500);
    expect(trail[trail.length - 1]).toEqual(at(600 * 0.0005));
  });
});
