import { beforeEach, describe, expect, it } from 'vitest';

import type { MeshNode } from '../types';
import {
  detectCuSpike,
  diagnoseConnectedNode,
  diagnoseOtherNode,
  resetCuSpikeCooldown,
} from './RFDiagnosticEngine';

function baseNode(overrides: Partial<MeshNode> = {}): MeshNode {
  return {
    node_id: 0x1,
    long_name: 'N',
    short_name: 'N',
    hw_model: '',
    snr: 0,
    battery: 0,
    last_heard: Date.now(),
    latitude: null,
    longitude: null,
    num_packets_rx: 100,
    num_packets_rx_bad: 0,
    num_rx_dupe: 0,
    ...overrides,
  };
}

describe('detectCuSpike', () => {
  beforeEach(() => {
    resetCuSpikeCooldown();
  });

  it('returns null when sample count below gate', () => {
    expect(
      detectCuSpike(50, { average: 10, sampleCount: 5, spanMs: 60 * 60 * 1000 }, 1),
    ).toBeNull();
  });

  it('returns null when span below gate', () => {
    expect(
      detectCuSpike(50, { average: 10, sampleCount: 20, spanMs: 10 * 60 * 1000 }, 1),
    ).toBeNull();
  });

  it('returns null when current not over 2x average', () => {
    expect(
      detectCuSpike(15, { average: 10, sampleCount: 20, spanMs: 60 * 60 * 1000 }, 1),
    ).toBeNull();
  });

  it('returns finding when gates pass', () => {
    const f = detectCuSpike(50, { average: 10, sampleCount: 20, spanMs: 60 * 60 * 1000 }, 1);
    expect(f).not.toBeNull();
    expect(f!.condition).toBe('Channel Utilization Spike');
  });
});

describe('diagnoseConnectedNode Hidden Terminal', () => {
  it('does not add Hidden Terminal when industrial interference present', () => {
    const node = baseNode({
      channel_utilization: 50,
      num_packets_rx_bad: 25,
      num_packets_rx: 100,
    });
    const findings = diagnoseConnectedNode(node);
    const conditions = findings.map((f) => f.condition);
    expect(conditions).toContain('900MHz Industrial Interference');
    expect(conditions).not.toContain('Hidden Terminal Risk');
  });

  it('adds Hidden Terminal in moderate bad band with high CU', () => {
    const node = baseNode({
      channel_utilization: 45,
      num_packets_rx_bad: 8,
      num_packets_rx: 100,
    });
    const findings = diagnoseConnectedNode(node);
    expect(findings.some((f) => f.condition === 'Hidden Terminal Risk')).toBe(true);
  });
});

describe('diagnoseOtherNode', () => {
  it('accepts optional CU context for spike', () => {
    resetCuSpikeCooldown();
    const node = baseNode({
      node_id: 0x2,
      channel_utilization: 60,
      air_util_tx: 10,
    });
    const findings = diagnoseOtherNode(node, {
      cuStats24h: { average: 10, sampleCount: 20, spanMs: 60 * 60 * 1000 },
    });
    expect(findings).not.toBeNull();
    expect(findings!.some((f) => f.condition === 'Channel Utilization Spike')).toBe(true);
  });
});
