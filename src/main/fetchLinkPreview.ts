import { sanitizeLogMessage } from './sanitize-log-message';

export const LINK_PREVIEW_FETCH_TIMEOUT_MS = 10_000;
export const LINK_PREVIEW_MAX_HTML_BYTES = 65_536;

const LINK_PREVIEW_IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const LINK_PREVIEW_BLOCKED_HOSTNAMES = new Set(['localhost', '[::1]', '::1', '0.0.0.0']);

export function isBlockedHostname(hostname: string): boolean {
  return (
    LINK_PREVIEW_BLOCKED_HOSTNAMES.has(hostname.toLowerCase()) || LINK_PREVIEW_IP_RE.test(hostname)
  );
}

export interface LinkPreviewMetadata {
  title: string;
  description?: string;
  image?: string;
}

export async function fetchLinkPreview(urlString: string): Promise<LinkPreviewMetadata | null> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    // catch-no-log-ok invalid URL string — silent failure by design
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (isBlockedHostname(url.hostname)) return null;

  try {
    const response = await fetch(urlString, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(LINK_PREVIEW_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (total < LINK_PREVIEW_MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        const remaining = LINK_PREVIEW_MAX_HTML_BYTES - total;
        const slice = value.length <= remaining ? value : value.subarray(0, remaining);
        chunks.push(slice);
        total += slice.length;
      }
    } finally {
      void reader.cancel();
    }

    if (total === 0) return null;

    const merged = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) {
      merged.set(chunk, pos);
      pos += chunk.length;
    }
    const html = new TextDecoder().decode(merged);

    const ogTitle =
      /<meta\s+property="og:title"\s+content="([^"]+)"/i.exec(html)?.[1] ??
      /<meta\s+content="([^"]+)"\s+property="og:title"/i.exec(html)?.[1] ??
      /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];
    if (!ogTitle?.trim()) return null;

    const title = ogTitle.trim();

    const ogDesc =
      /<meta\s+property="og:description"\s+content="([^"]+)"/i.exec(html)?.[1] ??
      /<meta\s+content="([^"]+)"\s+property="og:description"/i.exec(html)?.[1] ??
      /<meta\s+name="description"\s+content="([^"]+)"/i.exec(html)?.[1];
    const description = ogDesc?.trim() || undefined;

    const ogImage =
      /<meta\s+property="og:image"\s+content="([^"]+)"/i.exec(html)?.[1] ??
      /<meta\s+content="([^"]+)"\s+property="og:image"/i.exec(html)?.[1];
    const image = ogImage?.trim().startsWith('https://') ? ogImage.trim() : undefined;

    return { title, description, image };
  } catch (err) {
    console.debug(
      '[chat] fetchLinkPreview error:',
      sanitizeLogMessage(err instanceof Error ? err.message : String(err)),
    );
    return null;
  }
}
