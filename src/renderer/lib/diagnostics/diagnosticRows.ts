import type { DiagnosticRow, NodeAnomaly, RfDiagnosticRow, RoutingDiagnosticRow } from '../types';
import { nodeAnomalyToRoutingRow, rfRowId, routingRowToNodeAnomaly } from '../types';
import type { RFDiagnosis } from './RFDiagnosticEngine';

/** Align with hop/CU history windows in diagnosticsStore. */
export const DEFAULT_ROUTING_DIAGNOSTIC_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** RF findings are telemetry snapshots — shorter TTL reduces stale Mesh Congestion etc. */
export const DEFAULT_RF_DIAGNOSTIC_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Drop rows whose detectedAt is older than max age. Routing rows refresh detectedAt on each
 * analyzeNode; if a node goes quiet the row ages out. RF uses rfMaxAgeMs when provided.
 */
export function pruneDiagnosticRowsByAge(
  rows: DiagnosticRow[],
  now: number,
  routingMaxAgeMs: number,
  rfMaxAgeMs?: number,
): DiagnosticRow[] {
  const rfLimit = rfMaxAgeMs ?? routingMaxAgeMs;
  return rows.filter((r) => {
    const limit = r.kind === 'rf' ? rfLimit : routingMaxAgeMs;
    return now - r.detectedAt <= limit;
  });
}

/** Build Map of routing anomalies only (for meshCongestionAttribution, legacy APIs). */
export function diagnosticRowsToRoutingMap(rows: DiagnosticRow[]): Map<number, NodeAnomaly> {
  const m = new Map<number, NodeAnomaly>();
  for (const r of rows) {
    if (r.kind === 'routing') m.set(r.nodeId, routingRowToNodeAnomaly(r));
  }
  return m;
}

/** Node IDs that have a routing anomaly (for map include list). */
export function routingAnomalyNodeIds(rows: DiagnosticRow[]): Set<number> {
  const s = new Set<number>();
  for (const r of rows) {
    if (r.kind === 'routing') s.add(r.nodeId);
  }
  return s;
}

export function getRoutingRowForNode(
  rows: DiagnosticRow[],
  nodeId: number,
): RoutingDiagnosticRow | null {
  for (const r of rows) {
    if (r.kind === 'routing' && r.nodeId === nodeId) return r;
  }
  return null;
}

export function meshHasRoutingAnomaliesFromRows(rows: DiagnosticRow[]): boolean {
  for (const r of rows) {
    if (r.kind === 'routing' && (r.type === 'bad_route' || r.type === 'hop_goblin')) {
      return true;
    }
  }
  return false;
}

export function rfDiagnosesToRows(nodeId: number, findings: RFDiagnosis[]): RfDiagnosticRow[] {
  const now = Date.now();
  return findings.map((f) => ({
    kind: 'rf' as const,
    id: rfRowId(nodeId, f.condition),
    nodeId,
    condition: f.condition,
    cause: f.cause,
    severity: f.severity,
    detectedAt: now,
    isLastHop: f.isLastHop,
  }));
}

/** Replace all routing rows with map contents; keep RF rows. */
export function replaceRoutingRowsFromMap(
  current: DiagnosticRow[],
  routingMap: Map<number, NodeAnomaly>,
): DiagnosticRow[] {
  const rfOnly = current.filter((r): r is RfDiagnosticRow => r.kind === 'rf');
  const routingRows: RoutingDiagnosticRow[] = [];
  for (const a of routingMap.values()) {
    routingRows.push(nodeAnomalyToRoutingRow(a));
  }
  return [...routingRows, ...rfOnly];
}

/** Remove all RF rows for nodeId then append new ones. */
export function replaceRfRowsForNode(
  current: DiagnosticRow[],
  nodeId: number,
  findings: RFDiagnosis[],
): DiagnosticRow[] {
  const withoutRf = current.filter((r) => r.kind !== 'rf' || r.nodeId !== nodeId);
  return [...withoutRf, ...rfDiagnosesToRows(nodeId, findings)];
}
