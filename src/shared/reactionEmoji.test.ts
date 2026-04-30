import { describe, expect, it } from 'vitest';

import {
  MESHTASTIC_TAPBACK_DATA_EMOJI_FLAG,
  meshtasticWireUint32AllowZero,
  meshtasticWireUint32NonZero,
  sanitizeUnicodeReactionScalar,
} from './reactionEmoji';

describe('MESHTASTIC_TAPBACK_DATA_EMOJI_FLAG', () => {
  it('matches Meshtastic mesh.proto boolean-as-fixed32 convention', () => {
    expect(MESHTASTIC_TAPBACK_DATA_EMOJI_FLAG).toBe(1);
  });
});

describe('meshtasticWireUint32NonZero', () => {
  it('returns undefined for nullish and zero', () => {
    expect(meshtasticWireUint32NonZero(null)).toBeUndefined();
    expect(meshtasticWireUint32NonZero(0)).toBeUndefined();
  });

  it('normalizes signed 32-bit mesh ids to uint32', () => {
    const signed = 0xb2a7c770 - 2 ** 32;
    expect(meshtasticWireUint32NonZero(signed)).toBe(0xb2a7c770);
  });
});

describe('meshtasticWireUint32AllowZero', () => {
  it('preserves zero and normalizes signed ids', () => {
    expect(meshtasticWireUint32AllowZero(0)).toBe(0);
    const signed = 0xb2a7c770 - 2 ** 32;
    expect(meshtasticWireUint32AllowZero(signed)).toBe(0xb2a7c770);
  });
});

describe('sanitizeUnicodeReactionScalar', () => {
  it('accepts Meshtastic wire indices 1..12, thumbs-up, and heart (typical picker / on-wire values)', () => {
    expect(sanitizeUnicodeReactionScalar(1)).toBe(1);
    expect(sanitizeUnicodeReactionScalar(12)).toBe(12);
    expect(sanitizeUnicodeReactionScalar(0x1f44d)).toBe(0x1f44d);
    expect(sanitizeUnicodeReactionScalar(0x2764)).toBe(0x2764);
  });

  it('rejects zero, negative, and above Unicode max', () => {
    expect(sanitizeUnicodeReactionScalar(0)).toBeUndefined();
    expect(sanitizeUnicodeReactionScalar(-1)).toBeUndefined();
    expect(sanitizeUnicodeReactionScalar(53477377)).toBeUndefined();
    expect(sanitizeUnicodeReactionScalar(0x110000)).toBeUndefined();
  });

  it('rejects surrogate code units', () => {
    expect(sanitizeUnicodeReactionScalar(0xd800)).toBeUndefined();
    expect(sanitizeUnicodeReactionScalar(0xdfff)).toBeUndefined();
  });

  it('rejects non-finite numbers', () => {
    expect(sanitizeUnicodeReactionScalar(NaN)).toBeUndefined();
    expect(sanitizeUnicodeReactionScalar(Infinity)).toBeUndefined();
  });
});
