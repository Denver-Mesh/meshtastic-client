import { describe, it, expect } from 'vitest';
import { filterMissingKeysToTranslate } from './i18n-auto-translate-lib.mjs';

describe('filterMissingKeysToTranslate', () => {
  const enKeys = ['a', 'b', 'c'];

  it('incremental: only new English keys that are missing locally', () => {
    const existing = { a: 'x' };
    const added = new Set(['b', 'c']);
    expect(
      filterMissingKeysToTranslate(enKeys, existing, added, {
        translateAllGaps: false,
        hasGitBaseline: true,
      }),
    ).toEqual(['b', 'c']);
  });

  it('incremental: skips keys already present locally even if in added set', () => {
    const existing = { b: 'y' };
    const added = new Set(['b', 'c']);
    expect(
      filterMissingKeysToTranslate(enKeys, existing, added, {
        translateAllGaps: false,
        hasGitBaseline: true,
      }),
    ).toEqual(['c']);
  });

  it('translateAllGaps: fills every missing key regardless of added set', () => {
    const existing = { a: 'x' };
    const added = new Set(['b']);
    expect(
      filterMissingKeysToTranslate(enKeys, existing, added, {
        translateAllGaps: true,
        hasGitBaseline: true,
      }),
    ).toEqual(['b', 'c']);
  });

  it('without git baseline: fill all missing keys (cannot restrict to new EN keys)', () => {
    const existing = { a: 'x' };
    expect(
      filterMissingKeysToTranslate(enKeys, existing, null, {
        translateAllGaps: false,
        hasGitBaseline: false,
      }),
    ).toEqual(['b', 'c']);
  });
});
