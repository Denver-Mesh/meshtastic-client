import { useEffect, useState } from "react";
import type { MeshNode } from "../lib/types";
import { RoleDisplay } from "../lib/roleInfo";

interface NodeDetailModalProps {
  node: MeshNode | null;
  onClose: () => void;
  onRequestPosition: (nodeNum: number) => Promise<void>;
  onTraceRoute: (nodeNum: number) => Promise<void>;
  traceRouteHops?: string[];
  onDeleteNode: (nodeNum: number) => Promise<void>;
  isConnected: boolean;
}

function formatTime(ts: number): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString();
}

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-700/50 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-medium ${className || "text-gray-200"}`}>
        {value}
      </span>
    </div>
  );
}

export default function NodeDetailModal({
  node,
  onClose,
  onRequestPosition,
  onTraceRoute,
  traceRouteHops,
  onDeleteNode,
  isConnected,
}: NodeDetailModalProps) {
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [positionRequestedAt, setPositionRequestedAt] = useState<number | null>(null);
  const [traceRoutePending, setTraceRoutePending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Reset all state when node changes
  useEffect(() => {
    setActionStatus(null);
    setPositionRequestedAt(null);
    setTraceRoutePending(false);
    setShowDeleteConfirm(false);
  }, [node?.node_id]);

  // Detect position update after a request was sent
  useEffect(() => {
    if (positionRequestedAt !== null) {
      setPositionRequestedAt(null);
      setActionStatus("Position updated");
    }
  }, [node?.latitude, node?.longitude]);

  // 30-second timeout for position request
  useEffect(() => {
    if (!positionRequestedAt) return;
    const timer = setTimeout(() => {
      setPositionRequestedAt(null);
      setActionStatus("Position request timed out");
    }, 30_000);
    return () => clearTimeout(timer);
  }, [positionRequestedAt]);

  // Clear trace route pending when result arrives
  useEffect(() => {
    if (traceRouteHops) setTraceRoutePending(false);
  }, [traceRouteHops]);

  // 60-second timeout for trace route
  useEffect(() => {
    if (!traceRoutePending) return;
    const timer = setTimeout(() => {
      setTraceRoutePending(false);
      setActionStatus("Trace route timed out");
    }, 60_000);
    return () => clearTimeout(timer);
  }, [traceRoutePending]);

  if (!node) return null;

  const hexId = `!${node.node_id.toString(16)}`;
  const displayName = node.short_name || node.long_name || hexId;

  const batteryColor =
    node.battery > 50
      ? "text-bright-green"
      : node.battery > 20
      ? "text-yellow-400"
      : node.battery > 0
      ? "text-red-400"
      : "text-muted";

  const snrColor =
    node.snr > 5
      ? "text-bright-green"
      : node.snr > 0
      ? "text-yellow-400"
      : node.snr !== 0
      ? "text-red-400"
      : "text-muted";

  const handleRequestPosition = async () => {
    setPositionRequestedAt(Date.now());
    setActionStatus("Requesting position...");
    try {
      await onRequestPosition(node.node_id);
    } catch {
      setPositionRequestedAt(null);
      setActionStatus("Position request failed");
    }
  };

  const handleTraceRoute = async () => {
    setTraceRoutePending(true);
    setActionStatus("Trace route requested...");
    try {
      await onTraceRoute(node.node_id);
    } catch {
      setTraceRoutePending(false);
      setActionStatus("Trace route failed");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-deep-black border border-gray-700 rounded-xl max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-100 truncate">
              {displayName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted font-mono">{hexId}</span>
              {node.hw_model && node.hw_model !== "0" && (
                <span className="text-xs text-muted">
                  {node.hw_model}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary-dark text-muted hover:text-gray-200 transition-colors shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-3">
          {/* Names */}
          {node.long_name && (
            <InfoRow label="Long Name" value={node.long_name} />
          )}
          {node.short_name && (
            <InfoRow label="Short Name" value={node.short_name} />
          )}

          {/* Role */}
          <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
            <span className="text-sm text-muted">Role</span>
            <RoleDisplay role={node.role} />
          </div>

          {/* Signal */}
          <InfoRow
            label="SNR"
            value={node.snr !== 0 ? `${node.snr.toFixed(1)} dB` : "—"}
            className={snrColor}
          />

          {/* Battery */}
          <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
            <span className="text-sm text-muted">Battery</span>
            <div className="flex items-center gap-2">
              {node.battery > 0 && (
                <div className="w-16 h-2 bg-secondary-dark rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      node.battery > 50
                        ? "bg-brand-green"
                        : node.battery > 20
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(node.battery, 100)}%` }}
                  />
                </div>
              )}
              <span className={`text-sm font-medium ${batteryColor}`}>
                {node.battery > 0 ? `${node.battery}%` : "—"}
              </span>
            </div>
          </div>

          {/* Timing */}
          <InfoRow label="Last Heard" value={formatTime(node.last_heard)} />

          {/* Location */}
          {(node.latitude !== 0 || node.longitude !== 0) && (
            <InfoRow
              label="Position"
              value={`${node.latitude.toFixed(5)}, ${node.longitude.toFixed(5)}`}
              className="text-gray-300 font-mono text-xs"
            />
          )}

          {/* Trace route result */}
          {traceRouteHops && (
            <div className="mt-3 p-2 bg-primary-dark rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Route Path</div>
              <div className="text-sm text-gray-200 flex flex-wrap items-center gap-1">
                {traceRouteHops.map((hop, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-500">→</span>}
                    <span
                      className={
                        i === 0 || i === traceRouteHops.length - 1
                          ? "text-green-400 font-medium"
                          : "text-gray-200"
                      }
                    >
                      {hop}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-gray-700 flex items-center gap-2">
          <button
            onClick={handleRequestPosition}
            disabled={!isConnected || positionRequestedAt !== null}
            className="flex-1 px-3 py-2 text-sm font-medium bg-secondary-dark hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors"
          >
            📍 Request Position
          </button>
          <button
            onClick={handleTraceRoute}
            disabled={!isConnected || traceRoutePending}
            className="flex-1 px-3 py-2 text-sm font-medium bg-secondary-dark hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors"
          >
            🛤 Trace Route
          </button>
        </div>

        {/* Action status */}
        {actionStatus && (
          <div className="px-5 pb-3">
            <div className="text-xs text-muted text-center">
              {actionStatus}
            </div>
          </div>
        )}

        {/* Delete node */}
        <div className="px-5 pb-4">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full mt-2 px-3 py-2 text-sm font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-lg transition-colors border border-red-900/50"
            >
              Delete Node
            </button>
          ) : (
            <div className="mt-2 p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
              <p className="text-xs text-red-300 mb-2">
                Remove this node from local database? It will reappear when it broadcasts again.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 py-1.5 text-xs bg-secondary-dark hover:bg-gray-600 text-gray-300 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onDeleteNode(node.node_id).then(onClose)}
                  className="flex-1 px-3 py-1.5 text-xs bg-red-800 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
