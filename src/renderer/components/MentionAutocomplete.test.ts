import { describe, expect, it } from 'vitest';

import type { MeshNode } from '../lib/types';
import { buildMentionCandidates } from './MentionAutocomplete';

function makeNode(nodeId: number, longName: string, shortName: string): MeshNode {
  return {
    node_id: nodeId,
    long_name: longName,
    short_name: shortName,
    hw_model: '',
    snr: 0,
    battery: 0,
    last_heard: Date.now(),
    latitude: null,
    longitude: null,
  };
}

// Meshtastic: nodeDisplayName prefers short_name || long_name
// MeshCore:   nodeDisplayName prefers long_name  || short_name
const nodes = new Map([
  [1, makeNode(1, 'Alice Smith', 'Ali')], // meshtastic display: 'Ali'
  [2, makeNode(2, 'Bob Jones', 'Bob')], // meshtastic display: 'Bob'
  [3, makeNode(3, 'Alicia Keys', 'AK')], // meshtastic display: 'AK'
]);

describe('buildMentionCandidates', () => {
  it('returns all nodes on empty query', () => {
    const results = buildMentionCandidates(nodes, 'meshtastic', '');
    expect(results.length).toBe(3);
  });

  it('prefix-matches on short_name for meshtastic', () => {
    // 'Ali' starts with 'al'; 'Bob' and 'AK' do not
    const results = buildMentionCandidates(nodes, 'meshtastic', 'al');
    expect(results.map((c) => c.nodeId)).toContain(1);
    expect(results.map((c) => c.nodeId)).not.toContain(2);
    expect(results.map((c) => c.nodeId)).not.toContain(3);
  });

  it('prefix-matches on long_name for meshcore', () => {
    // meshcore uses long_name first: 'Alice Smith' and 'Alicia Keys' both start with 'ali'
    const results = buildMentionCandidates(nodes, 'meshcore', 'ali');
    expect(results.map((c) => c.nodeId)).toContain(1);
    expect(results.map((c) => c.nodeId)).toContain(3);
    expect(results.map((c) => c.nodeId)).not.toContain(2);
  });

  it('is case-insensitive', () => {
    // 'Ali' lowercased is 'ali'; query 'AL' lowercased is 'al'
    const results = buildMentionCandidates(nodes, 'meshtastic', 'AL');
    expect(results.map((c) => c.nodeId)).toContain(1);
  });

  it('returns at most 6 candidates', () => {
    // Use long short_names starting with 'al' so meshtastic prefix match works
    const big = new Map(
      Array.from({ length: 10 }, (_, i) => [i, makeNode(i, `Node${i}`, `Alpha${i}`)]),
    );
    const results = buildMentionCandidates(big, 'meshtastic', 'alpha');
    expect(results.length).toBe(6);
  });

  it('returns empty array when no nodes match', () => {
    const results = buildMentionCandidates(nodes, 'meshtastic', 'xyz');
    expect(results).toEqual([]);
  });

  it('candidate name is a non-empty string', () => {
    const results = buildMentionCandidates(nodes, 'meshtastic', 'al');
    expect(results.length).toBeGreaterThan(0);
    for (const c of results) {
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(0);
    }
  });
});
