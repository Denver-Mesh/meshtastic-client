// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchLinkPreview, isBlockedHostname } from './fetchLinkPreview';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

function makeStreamResponse(html: string, contentType = 'text/html; charset=utf-8'): Response {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(html);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': contentType }),
    body: stream,
  } as unknown as Response;
}

describe('isBlockedHostname', () => {
  it('blocks dotted-decimal IPv4', () => {
    expect(isBlockedHostname('192.168.1.1')).toBe(true);
    expect(isBlockedHostname('10.0.0.1')).toBe(true);
    expect(isBlockedHostname('127.0.0.1')).toBe(true);
  });

  it('blocks localhost', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('LOCALHOST')).toBe(true);
  });

  it('blocks IPv6 loopback forms', () => {
    expect(isBlockedHostname('[::1]')).toBe(true);
    expect(isBlockedHostname('::1')).toBe(true);
  });

  it('blocks 0.0.0.0', () => {
    expect(isBlockedHostname('0.0.0.0')).toBe(true);
  });

  it('allows public hostnames', () => {
    expect(isBlockedHostname('example.com')).toBe(false);
    expect(isBlockedHostname('sub.example.org')).toBe(false);
  });
});

describe('fetchLinkPreview', () => {
  it('returns null for invalid URL', async () => {
    expect(await fetchLinkPreview('not a url')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for non-http(s) protocols', async () => {
    expect(await fetchLinkPreview('ftp://example.com')).toBeNull();
    expect(await fetchLinkPreview('file:///etc/passwd')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for localhost URLs (SSRF guard)', async () => {
    expect(await fetchLinkPreview('http://localhost/admin')).toBeNull();
    expect(await fetchLinkPreview('http://localhost:8080/api')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for IPv6 loopback URLs (SSRF guard)', async () => {
    expect(await fetchLinkPreview('http://[::1]/')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for IPv4 address URLs', async () => {
    expect(await fetchLinkPreview('http://192.168.1.1/')).toBeNull();
    expect(await fetchLinkPreview('http://10.0.0.1/path')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null when fetch response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, headers: new Headers() });
    expect(await fetchLinkPreview('https://example.com/missing')).toBeNull();
  });

  it('returns null for redirects (redirect:manual gives ok=false)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 301,
      headers: new Headers(),
      type: 'opaqueredirect',
    });
    expect(await fetchLinkPreview('https://example.com')).toBeNull();
  });

  it('passes redirect:manual to fetch', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 301, headers: new Headers() });
    await fetchLinkPreview('https://example.com');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('returns null for non-HTML content-type', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    expect(await fetchLinkPreview('https://example.com/api')).toBeNull();
  });

  it('returns null when body is null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: null,
    });
    expect(await fetchLinkPreview('https://example.com')).toBeNull();
  });

  it('returns null when body is empty', async () => {
    const emptyStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.close();
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: emptyStream,
    });
    expect(await fetchLinkPreview('https://example.com')).toBeNull();
  });

  it('returns null when OG title is absent', async () => {
    mockFetch.mockResolvedValue(makeStreamResponse('<html><body>no title here</body></html>'));
    expect(await fetchLinkPreview('https://example.com')).toBeNull();
  });

  it('parses og:title in property-first attribute order', async () => {
    const html = `<meta property="og:title" content="My Page Title">`;
    mockFetch.mockResolvedValue(makeStreamResponse(html));
    const result = await fetchLinkPreview('https://example.com');
    expect(result?.title).toBe('My Page Title');
  });

  it('parses og:title in content-first attribute order', async () => {
    const html = `<meta content="Reversed Title" property="og:title">`;
    mockFetch.mockResolvedValue(makeStreamResponse(html));
    const result = await fetchLinkPreview('https://example.com');
    expect(result?.title).toBe('Reversed Title');
  });

  it('falls back to <title> tag when og:title absent', async () => {
    const html = `<html><head><title>Plain Title</title></head></html>`;
    mockFetch.mockResolvedValue(makeStreamResponse(html));
    const result = await fetchLinkPreview('https://example.com');
    expect(result?.title).toBe('Plain Title');
  });

  it('parses description and image', async () => {
    const html = [
      `<meta property="og:title" content="Title">`,
      `<meta property="og:description" content="Desc text">`,
      `<meta property="og:image" content="https://example.com/img.png">`,
    ].join('\n');
    mockFetch.mockResolvedValue(makeStreamResponse(html));
    const result = await fetchLinkPreview('https://example.com');
    expect(result).toEqual({
      title: 'Title',
      description: 'Desc text',
      image: 'https://example.com/img.png',
    });
  });

  it('rejects http:// og:image (must be https)', async () => {
    const html = [
      `<meta property="og:title" content="Title">`,
      `<meta property="og:image" content="http://example.com/img.png">`,
    ].join('\n');
    mockFetch.mockResolvedValue(makeStreamResponse(html));
    const result = await fetchLinkPreview('https://example.com');
    expect(result?.image).toBeUndefined();
  });

  it('reads only up to LINK_PREVIEW_MAX_HTML_BYTES', async () => {
    const bigChunk = new Uint8Array(200_000).fill(65); // 200 KB of 'A'
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bigChunk);
        controller.close();
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: stream,
    });
    // No title in 200KB of 'A's → returns null without OOMing
    expect(await fetchLinkPreview('https://example.com')).toBeNull();
  });

  it('returns null and logs on fetch error', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error('network failure'));
    expect(await fetchLinkPreview('https://example.com')).toBeNull();
    expect(debugSpy).toHaveBeenCalledWith(
      '[chat] fetchLinkPreview error:',
      expect.stringContaining('network failure'),
    );
  });
});
