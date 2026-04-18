import { describe, expect, it } from 'vitest';

import { routeWeightToColor, routeWeightToStroke } from './routeWeightUtils';

describe('routeWeightToStroke', () => {
  it('maps min weight to 1px', () => {
    expect(routeWeightToStroke(0, 10)).toBe(1);
  });
  it('maps max weight to 8px', () => {
    expect(routeWeightToStroke(10, 10)).toBe(8);
  });
  it('maps midpoint correctly', () => {
    expect(routeWeightToStroke(5, 10)).toBe(4.5);
  });
  it('falls back to minimum when maxWeight is invalid', () => {
    expect(routeWeightToStroke(5, 0)).toBe(1);
    expect(routeWeightToStroke(5, Number.NaN)).toBe(1);
  });
});

describe('routeWeightToColor', () => {
  it('returns gray at weight=0', () => {
    expect(routeWeightToColor(0, 10)).toBe('rgb(107,114,128)');
  });
  it('returns brand green at max weight', () => {
    expect(routeWeightToColor(10, 10)).toBe('rgb(34,197,94)');
  });
  it('returns gray when values are invalid', () => {
    expect(routeWeightToColor(10, 0)).toBe('rgb(107,114,128)');
    expect(routeWeightToColor(Number.NaN, 10)).toBe('rgb(107,114,128)');
  });
});
