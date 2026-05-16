// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { checkLine } from './check-url-hostname-sanitization.mjs';

describe('check-url-hostname-sanitization', () => {
  it('flags href.includes with a hostname literal', () => {
    const hits = checkLine("if (href.includes('opengraph.githubassets.com')) {");
    expect(hits).toHaveLength(1);
    expect(hits[0].literal).toBe('opengraph.githubassets.com');
  });

  it('allows hostname equality after URL parse', () => {
    expect(
      checkLine("if (fetchRequestHostname(input) === 'opengraph.githubassets.com') {"),
    ).toHaveLength(0);
  });

  it('ignores non-hostname literals', () => {
    expect(checkLine("if (contentType.includes('text/html')) {")).toHaveLength(0);
    expect(checkLine("expect(svg.includes('scale(0.4167)')).toBe(true);")).toHaveLength(0);
    expect(checkLine("expect(topic.includes('2/e/')).toBe(true);")).toHaveLength(0);
  });

  it('ignores lines without URL context', () => {
    expect(checkLine("if (msg.includes('example.com')) {")).toHaveLength(0);
  });

  it('respects url-hostname-check-ok suppression', () => {
    expect(
      checkLine("if (href.includes('example.com')) { // url-hostname-check-ok test fixture"),
    ).toHaveLength(0);
  });
});
