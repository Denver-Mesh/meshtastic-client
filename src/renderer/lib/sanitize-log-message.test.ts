/**
 * Tests for log sanitization (log injection prevention).
 * See CONTRIBUTING.md § Log injection (CodeQL js/log-injection). When changing
 * the log pipeline or sanitizeLogMessage, ensure these tests still pass so
 * regressions are caught by the suite.
 */
import { describe, expect, it } from 'vitest';

import { sanitizeLogMessage } from '@/main/sanitize-log-message';

describe('sanitizeLogMessage', () => {
  it('strips newlines and keeps output on one line', () => {
    expect(sanitizeLogMessage('a\nb')).toBe('a b');
    expect(sanitizeLogMessage('a\r\nb')).toBe('a b');
    expect(sanitizeLogMessage('line1\n[INFO] forged\nline2')).toBe('line1 [INFO] forged line2');
  });

  it('strips other control characters', () => {
    expect(sanitizeLogMessage('a\x00b')).toBe('a b');
    expect(sanitizeLogMessage('a\tb')).toBe('a b');
    expect(sanitizeLogMessage('a\u2028b')).toBe('a b');
  });

  it('normalizes multiple spaces to one', () => {
    expect(sanitizeLogMessage('a   b')).toBe('a b');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeLogMessage('  x  ')).toBe('x');
  });

  it('handles non-strings by stringifying', () => {
    expect(sanitizeLogMessage(123)).toBe('123');
    expect(sanitizeLogMessage(null)).toBe('null');
  });
});
