/**
 * Sanitize untrusted or user-controlled text before it is persisted or forwarded as a log line.
 * Strips control characters (including newlines) and normalizes whitespace so each entry stays
 * one line and log injection is avoided. Used by log-service and tested by sanitize-log-message.test.ts.
 */
export function sanitizeLogMessage(message: unknown): string {
  return String(message)
    .replace(/[\x00-\x1F\x7F\u2028\u2029]+/g, ' ') // eslint-disable-line no-control-regex
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Same as sanitizeLogMessage but with .replace(/\n|\r/g, ' ') as the first step so CodeQL
 * js/log-injection recognizes the sanitizer (see query help). Used by log-service console
 * overrides; must stay in sync with that pattern for CodeQL and pre-commit tests.
 */
export function sanitizeForLogSink(raw: string): string {
  return raw
    .replace(/\n|\r/g, ' ')
    .replace(/[\x00-\x1F\x7F\u2028\u2029]+/g, ' ') // eslint-disable-line no-control-regex
    .replace(/\s+/g, ' ')
    .trim();
}
