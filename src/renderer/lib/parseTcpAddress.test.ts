import { describe, expect, it } from 'vitest';

import { parseTcpAddress } from './parseTcpAddress';

describe('parseTcpAddress', () => {
  it('returns default port 5000 for bare hostname', () => {
    expect(parseTcpAddress('localhost')).toEqual({ host: 'localhost', port: 5000 });
  });

  it('parses host:port', () => {
    expect(parseTcpAddress('localhost:5001')).toEqual({ host: 'localhost', port: 5001 });
  });

  it('parses IPv4 with port', () => {
    expect(parseTcpAddress('192.168.1.100:4403')).toEqual({ host: '192.168.1.100', port: 4403 });
  });

  it('returns default port when port part is not a valid integer', () => {
    expect(parseTcpAddress('localhost:abc')).toEqual({ host: 'localhost:abc', port: 5000 });
  });

  it('returns default port when port is 0', () => {
    expect(parseTcpAddress('localhost:0')).toEqual({ host: 'localhost:0', port: 5000 });
  });

  it('returns default port when port exceeds 65535', () => {
    expect(parseTcpAddress('localhost:99999')).toEqual({ host: 'localhost:99999', port: 5000 });
  });

  it('returns default port for empty string', () => {
    expect(parseTcpAddress('')).toEqual({ host: '', port: 5000 });
  });

  it('handles port at boundary values', () => {
    expect(parseTcpAddress('host:1')).toEqual({ host: 'host', port: 1 });
    expect(parseTcpAddress('host:65535')).toEqual({ host: 'host', port: 65535 });
  });
});
