import { useEffect, useState } from "react";
import type { MeshNode } from "../lib/types";
import { useDiagnosticsStore } from "../stores/diagnosticsStore";
import { computeHealthScore } from "../lib/diagnostics/RoutingDiagnosticEngine";

interface Props {
  nodes: Map<number, MeshNode>;
  myNodeNum: number;
  onTraceRoute: (nodeNum: number) => Promise<void>;
  isConnected: boolean;
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function formatTime(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function DiagnosticsPanel({
  nodes,
  myNodeNum,
  onTraceRoute,
  isConnected,
}: Props) {
  const anomalies = useDiagnosticsStore((s) => s.anomalies);
  const congestionHalosEnabled = useDiagnosticsStore((s) => s.congestionHalosEnabled);
  const setCongestionHalosEnabled = useDiagnosticsStore((s) => s.setCongestionHalosEnabled);
  const runReanalysis = useDiagnosticsStore((s) => s.runReanalysis);

  const [search, setSearch] = useState("");
  const [tracePending, setTracePending] = useState<number | null>(null);

  // Re-run full analysis whenever nodes change
  useEffect(() => {
    runReanalysis(nodes, myNodeNum);
  }, [nodes, myNodeNum, runReanalysis]);

  const totalNodes = nodes.size > 0 ? nodes.size - 1 : 0; // exclude self
  const healthScore = computeHealthScore(totalNodes, anomalies);

  const scoreColor =
    healthScore > 80
      ? "text-brand-green"
      : healthScore > 60
      ? "text-yellow-400"
      : "text-red-400";

  const scoreBg =
    healthScore > 80
      ? "bg-brand-green/10 border-brand-green/30"
      : healthScore > 60
      ? "bg-yellow-500/10 border-yellow-500/30"
      : "bg-red-500/10 border-red-500/30";

  const anomalyList = Array.from(anomalies.values()).filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const node = nodes.get(a.nodeId);
    return (
      node?.long_name?.toLowerCase().includes(q) ||
      node?.short_name?.toLowerCase().includes(q) ||
      a.nodeId.toString(16).includes(q) ||
      a.type.includes(q)
    );
  });

  const errorCount = Array.from(anomalies.values()).filter(
    (a) => a.severity === "error"
  ).length;
  const warningCount = Array.from(anomalies.values()).filter(
    (a) => a.severity === "warning"
  ).length;

  const handleTraceRoute = async (nodeId: number) => {
    setTracePending(nodeId);
    try {
      await onTraceRoute(nodeId);
    } finally {
      setTracePending(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-200">Network Diagnostics</h2>

      {/* Health Score */}
      <div className={`border rounded-xl p-5 ${scoreBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted mb-1">Network Health Score</div>
            <div className={`text-5xl font-bold ${scoreColor}`}>
              {healthScore}
              <span className="text-2xl ml-1 font-normal">/100</span>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted">
              <span>{totalNodes} nodes monitored</span>
              {errorCount > 0 && (
                <span className="text-red-400">
                  {errorCount} error{errorCount !== 1 ? "s" : ""}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-orange-400">
                  {warningCount} warning{warningCount !== 1 ? "s" : ""}
                </span>
              )}
              {anomalies.size === 0 && totalNodes > 0 && (
                <span className="text-brand-green">No issues detected</span>
              )}
            </div>
          </div>
          {anomalies.size > 0 && (
            <AlertTriangleIcon
              className={`w-12 h-12 ${
                errorCount > 0 ? "text-red-400" : "text-orange-400"
              } opacity-60`}
            />
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="bg-secondary-dark rounded-lg p-4">
        <h3 className="text-sm font-medium text-muted mb-3">Display Settings</h3>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="congestionHalos"
            checked={congestionHalosEnabled}
            onChange={(e) => setCongestionHalosEnabled(e.target.checked)}
            className="accent-brand-green"
          />
          <label htmlFor="congestionHalos" className="text-sm text-gray-300 cursor-pointer">
            Show channel utilization halos on map
          </label>
        </div>
      </div>

      {/* Anomaly Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-muted">
            Routing Anomalies ({anomalies.size})
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-48 px-3 py-1.5 bg-secondary-dark/80 rounded-lg text-gray-200 text-sm border border-gray-600/50 focus:border-brand-green/50 focus:outline-none"
          />
        </div>

        {anomalyList.length === 0 ? (
          <div className="bg-secondary-dark rounded-lg p-8 text-center text-muted text-sm">
            {anomalies.size === 0
              ? "No routing anomalies detected. The mesh looks healthy!"
              : "No anomalies match your search."}
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-deep-black text-muted text-left sticky top-0">
                  <th className="px-4 py-2.5">Node</th>
                  <th className="px-4 py-2.5">Offense</th>
                  <th className="px-4 py-2.5 text-right">SNR</th>
                  <th className="px-4 py-2.5 text-right">Hops</th>
                  <th className="px-4 py-2.5 text-right">Detected</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {anomalyList.map((anomaly) => {
                  const node = nodes.get(anomaly.nodeId);
                  const isError = anomaly.severity === "error";
                  const colorClass = isError ? "text-red-400" : "text-orange-400";
                  const hexId = `!${anomaly.nodeId.toString(16)}`;
                  const displayName =
                    node?.long_name || node?.short_name || hexId;

                  return (
                    <tr
                      key={anomaly.nodeId}
                      className="hover:bg-secondary-dark/50 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangleIcon
                            className={`w-4 h-4 shrink-0 ${colorClass}`}
                          />
                          <div>
                            <div className="text-gray-200 font-medium">
                              {displayName}
                            </div>
                            <div className="text-xs text-muted font-mono">
                              {hexId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className={`text-xs font-medium uppercase tracking-wide ${colorClass} mb-0.5`}>
                          {anomaly.type.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-gray-400 max-w-xs">
                          {anomaly.description}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-300 font-mono">
                        {anomaly.snr != null ? `${anomaly.snr.toFixed(1)} dB` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-300">
                        {anomaly.hopsAway != null ? anomaly.hopsAway : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted">
                        {formatTime(anomaly.detectedAt)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleTraceRoute(anomaly.nodeId)}
                          disabled={!isConnected || tracePending === anomaly.nodeId}
                          className="px-2.5 py-1 text-xs bg-secondary-dark hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded transition-colors whitespace-nowrap"
                        >
                          {tracePending === anomaly.nodeId ? "Tracing..." : "🛤 Trace"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
