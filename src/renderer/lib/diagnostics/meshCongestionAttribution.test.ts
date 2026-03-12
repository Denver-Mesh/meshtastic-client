import { describe, expect, it } from 'vitest';

import { summarizeRfDuplicateOriginators } from './meshCongestionAttribution';

describe('summarizeRfDuplicateOriginators', () => {
  it('returns empty when no RF-only multi-path records', () => {
    const cache = new Map<number, { fromNodeId: number; paths: { transport: string }[] }>();
    cache.set(1, { fromNodeId: 0x10, paths: [{ transport: 'rf' }] });
    cache.set(2, { fromNodeId: 0x10, paths: [{ transport: 'mqtt' }, { transport: 'rf' }] });
    expect(summarizeRfDuplicateOriginators(cache)).toEqual([]);
  });

  it('ranks originators by echo score for RF-only multi-path', () => {
    const cache = new Map<number, { fromNodeId: number; paths: { transport: string }[] }>();
    // originator 0x10: two records with 2 and 3 paths → extra 1 + 2 = 3
    cache.set(1, { fromNodeId: 0x10, paths: [{ transport: 'rf' }, { transport: 'rf' }] });
    cache.set(2, {
      fromNodeId: 0x10,
      paths: [{ transport: 'rf' }, { transport: 'rf' }, { transport: 'rf' }],
    });
    // originator 0x20: one record 2 paths → extra 1
    cache.set(3, { fromNodeId: 0x20, paths: [{ transport: 'rf' }, { transport: 'rf' }] });
    const r = summarizeRfDuplicateOriginators(cache);
    expect(r.length).toBe(2);
    expect(r[0].nodeId).toBe(0x10);
    expect(r[0].echoScore).toBe(3);
    expect(r[0].recordCount).toBe(2);
    expect(r[1].nodeId).toBe(0x20);
    expect(r[1].echoScore).toBe(1);
  });
});
