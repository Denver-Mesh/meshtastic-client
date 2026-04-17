import { describe, expect, it } from 'vitest';

import { meshcoreNodeHash, resolveNodeId } from './meshcoreNodeHash';

describe('meshcoreNodeHash', () => {
  it('XOR-folds 4 bytes correctly', () => {
    // 0xAA ^ 0xBB ^ 0xCC ^ 0xDD = 0x00
    expect(meshcoreNodeHash(0xaabbccdd)).toBe(0x00);
  });

  it('returns the single non-zero byte when all others are 0', () => {
    expect(meshcoreNodeHash(0xf6000000)).toBe(0xf6);
    expect(meshcoreNodeHash(0x00f60000)).toBe(0xf6);
    expect(meshcoreNodeHash(0x0000f600)).toBe(0xf6);
    expect(meshcoreNodeHash(0x000000f6)).toBe(0xf6);
  });

  it('returns 0 for node_id 0', () => {
    expect(meshcoreNodeHash(0x00000000)).toBe(0x00);
  });

  it('produces 1-byte output (0-255) for large node_ids', () => {
    const hash = meshcoreNodeHash(0xffffffff);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xff);
    // 0xFF ^ 0xFF ^ 0xFF ^ 0xFF = 0x00
    expect(hash).toBe(0x00);
  });

  it('matches sample packet src hash 0xF6', () => {
    // Raw packet: 0542e2b70647f8f6... — src hash byte is 0xF6
    // A node whose low byte alone contributes 0xF6 should round-trip.
    expect(meshcoreNodeHash(0x000000f6)).toBe(0xf6);
  });
});

describe('resolveNodeId', () => {
  it('returns null for empty node list', () => {
    expect(resolveNodeId(0xf6, [])).toBeNull();
  });

  it('returns null when no node matches', () => {
    const nodes = [{ node_id: 0xaabbccdd, last_heard: 1000 }]; // hash = 0x00
    expect(resolveNodeId(0xf6, nodes)).toBeNull();
  });

  it('returns the matching node_id for an unambiguous match', () => {
    const nodes = [
      { node_id: 0xf6000000, last_heard: 1000 }, // hash = 0xF6
      { node_id: 0xaabbccdd, last_heard: 2000 }, // hash = 0x00
    ];
    expect(resolveNodeId(0xf6, nodes)).toBe(0xf6000000);
  });

  it('returns the most-recently-heard node on hash collision', () => {
    // Both hash to 0xF6
    const stale = { node_id: 0xf6000000, last_heard: 1000 };
    const fresh = { node_id: 0x00f60000, last_heard: 9999 };
    const alsoStale = { node_id: 0x0000f600, last_heard: 500 };

    expect(resolveNodeId(0xf6, [stale, fresh, alsoStale])).toBe(0x00f60000);
    // Order-independent
    expect(resolveNodeId(0xf6, [fresh, stale, alsoStale])).toBe(0x00f60000);
  });

  it('handles a single-node list', () => {
    const nodes = [{ node_id: 0x000000f8, last_heard: 42 }]; // hash = 0xF8
    expect(resolveNodeId(0xf8, nodes)).toBe(0x000000f8);
  });
});
