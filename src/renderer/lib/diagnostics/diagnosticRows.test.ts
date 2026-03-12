import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RF_DIAGNOSTIC_MAX_AGE_MS,
  DEFAULT_ROUTING_DIAGNOSTIC_MAX_AGE_MS,
  pruneDiagnosticRowsByAge,
} from './diagnosticRows';

const routingRow = (nodeId: number, detectedAt: number) => ({
  kind: 'routing' as const,
  id: `routing:${nodeId}`,
  nodeId,
  type: 'bad_route' as const,
  severity: 'warning' as const,
  description: 'test',
  detectedAt,
});

const rfRow = (nodeId: number, detectedAt: number) => ({
  kind: 'rf' as const,
  id: `rf:${nodeId}:mesh_congestion`,
  nodeId,
  condition: 'Mesh Congestion',
  cause: 'dupes',
  severity: 'warning' as const,
  detectedAt,
});

describe('pruneDiagnosticRowsByAge', () => {
  it('keeps rows within routing max age', () => {
    const now = 1_000_000;
    const rows = [
      routingRow(1, now - 1000),
      routingRow(2, now - DEFAULT_ROUTING_DIAGNOSTIC_MAX_AGE_MS - 1),
    ];
    const out = pruneDiagnosticRowsByAge(rows, now, DEFAULT_ROUTING_DIAGNOSTIC_MAX_AGE_MS);
    expect(out).toHaveLength(1);
    expect(out[0].nodeId).toBe(1);
  });

  it('drops RF rows older than rf max age when rf max is shorter', () => {
    const now = 1_000_000;
    const rows = [rfRow(1, now - 1000), rfRow(2, now - DEFAULT_RF_DIAGNOSTIC_MAX_AGE_MS - 1)];
    const out = pruneDiagnosticRowsByAge(
      rows,
      now,
      DEFAULT_ROUTING_DIAGNOSTIC_MAX_AGE_MS,
      DEFAULT_RF_DIAGNOSTIC_MAX_AGE_MS,
    );
    expect(out).toHaveLength(1);
    expect(out[0].nodeId).toBe(1);
  });

  it('uses routing max for RF when rf max not passed', () => {
    const now = 1_000_000;
    const max = 60_000;
    const rows = [rfRow(1, now - max - 1)];
    const out = pruneDiagnosticRowsByAge(rows, now, max);
    expect(out).toHaveLength(0);
  });
});
