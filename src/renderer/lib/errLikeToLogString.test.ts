import { describe, expect, it } from 'vitest';

import { errLikeToLogString } from './errLikeToLogString';

describe('errLikeToLogString', () => {
  it('uses Error.message', () => {
    expect(errLikeToLogString(new Error('x'))).toBe('x');
  });

  it('JSON-stringifies plain objects when serializable', () => {
    expect(errLikeToLogString({ a: 1 })).toContain('"a"');
  });

  it('stringifies primitives', () => {
    expect(errLikeToLogString('plain')).toBe('plain');
  });
});
