export function parseTcpAddress(addr: string): { host: string; port: number } {
  const colonIdx = addr.lastIndexOf(':');
  if (colonIdx > 0) {
    const maybePort = Number(addr.slice(colonIdx + 1));
    if (Number.isInteger(maybePort) && maybePort >= 1 && maybePort <= 65535) {
      return { host: addr.slice(0, colonIdx), port: maybePort };
    }
  }
  return { host: addr, port: 5000 };
}
