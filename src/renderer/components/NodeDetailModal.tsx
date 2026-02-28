import { useEffect, useState } from "react";
import type { MeshNode } from "../lib/types";

interface NodeDetailModalProps {
  node: MeshNode | null;
  onClose: () => void;
  onRequestPosition: (nodeNum: number) => Promise<void>;
  onTraceRoute: (nodeNum: number) => Promise<void>;
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
  isConnected,
}: NodeDetailModalProps) {
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Reset status when node changes
  useEffect(() => {
    setActionStatus(null);
  }, [node?.node_id]);

  if (!node) return null;

  const hexId = `!${node.node_id.toString(16)}`;
  const displayName =
    node.short_name || node.long_name || hexId;

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

  const handleAction = async (
    name: string,
    action: () => Promise<void>
  ) => {
    setActionStatus(`${name}...`);
    try {
      await action();
      setActionStatus(`${name} sent`);
    } catch {
      setActionStatus(`${name} failed`);
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
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-gray-700 flex items-center gap-2">
          <button
            onClick={() =>
              handleAction("Position request", () =>
                onRequestPosition(node.node_id)
              )
            }
            disabled={!isConnected}
            className="flex-1 px-3 py-2 text-sm font-medium bg-secondary-dark hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors"
          >
            Request Position
          </button>
          <button
            onClick={() =>
              handleAction("Trace route", () =>
                onTraceRoute(node.node_id)
              )
            }
            disabled={!isConnected}
            className="flex-1 px-3 py-2 text-sm font-medium bg-secondary-dark hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors"
          >
            Trace Route
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-muted hover:text-gray-200 rounded-lg transition-colors"
          >
            Close
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
      </div>
    </div>
  );
}
