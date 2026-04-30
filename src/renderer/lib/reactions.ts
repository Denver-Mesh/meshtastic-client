/** Unicode codepoints for the 12 reaction emojis, in display order (matches ChatPanel REACTION_EMOJIS). */
export const REACTION_EMOJI_CODES = [
  128077, 10084, 128514, 128078, 127881, 128558, 128546, 128075, 128591, 128293, 9989, 129300,
] as const;

/**
 * Normalize a reaction emoji from the wire into a Unicode codepoint.
 * - Protocol may send emoji=1 as a flag and put the character in the payload: use payload's first codepoint.
 * - Protocol or other clients may send 1..12 as an index into the standard set: map to Unicode.
 * - Otherwise assume it's already a Unicode codepoint.
 */
export function normalizeReactionEmoji(
  wireEmoji: number | undefined,
  payloadUtf8: string,
): number | undefined {
  if (payloadUtf8.length > 0) {
    const cp = payloadUtf8.codePointAt(0);
    if (cp !== undefined && cp > 0x1000) return cp;
  }
  if (wireEmoji == null) return undefined;
  if (wireEmoji >= 1 && wireEmoji <= REACTION_EMOJI_CODES.length) {
    return REACTION_EMOJI_CODES[wireEmoji - 1];
  }
  if (wireEmoji < 1 || wireEmoji > 0x10ffff) {
    console.debug('[reactions] normalizeReactionEmoji out of range, skipping', wireEmoji);
    return undefined;
  }
  return wireEmoji;
}

const REACTION_NAMES = [
  'Like',
  'Love',
  'Laugh',
  'Dislike',
  'Party',
  'Wow',
  'Sad',
  'Wave',
  'Thanks',
  'Fire',
  'Check',
  'Thinking',
] as const;

/** Return display character for a stored emoji code (handles legacy index 1..12 and Unicode). */
export function emojiDisplayChar(code: number | null | undefined): string {
  if (code == null) return '';
  if (code >= 1 && code <= REACTION_EMOJI_CODES.length) {
    return String.fromCodePoint(REACTION_EMOJI_CODES[code - 1]);
  }
  if (code < 1 || code > 0x10ffff) {
    console.debug('[reactions] emojiDisplayChar out of range', code);
    return '\u2753';
  }
  try {
    return String.fromCodePoint(code);
  } catch (e) {
    console.debug('[reactions] emojiDisplayChar invalid codepoint', code, e);
    return '\u2753';
  }
}

/** Return label for tooltip (name for known reactions, character otherwise). */
export function emojiDisplayLabel(code: number | null | undefined): string {
  if (code == null) return '';
  if (code >= 1 && code <= REACTION_EMOJI_CODES.length) {
    return REACTION_NAMES[code - 1];
  }
  const idx = (REACTION_EMOJI_CODES as readonly number[]).indexOf(code);
  if (idx >= 0) return REACTION_NAMES[idx];
  return emojiDisplayChar(code);
}
