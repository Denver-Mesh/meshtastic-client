import { describe, expect, it } from 'vitest';

import { MESHTASTIC_TAPBACK_DATA_EMOJI_FLAG } from '../../shared/reactionEmoji';
import { normalizeReactionEmoji } from './reactions';

describe('normalizeReactionEmoji', () => {
  it('treats wire 1 as Meshtastic tapback boolean and takes first scalar from payload even when <= 0x1000', () => {
    const digitKeycap = '3\uFE0F\u20E3';
    expect(normalizeReactionEmoji(MESHTASTIC_TAPBACK_DATA_EMOJI_FLAG, digitKeycap)).toBe(
      digitKeycap.codePointAt(0),
    );
    expect(normalizeReactionEmoji(1, 'A')).toBe(65);
  });

  it('still maps wire 1 with empty payload to reaction index 1 (thumbs)', () => {
    const out = normalizeReactionEmoji(1, '   ');
    expect(out).toBe(128077);
  });

  it('maps wire indices 2..12 without payload to Unicode set', () => {
    expect(normalizeReactionEmoji(2, '')).toBe(10084);
    expect(normalizeReactionEmoji(12, '')).toBe(129300);
  });

  it('prefers payload high-plane codepoint when wire is not boolean 1', () => {
    expect(normalizeReactionEmoji(3, '👍')).toBe(0x1f44d);
  });
});
