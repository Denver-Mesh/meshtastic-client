import { useState, useCallback } from "react";
import type { MeshNode } from "../lib/types";
import { useToast } from "./Toast";

// ─── Confirmation Modal ─────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-600 rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-200">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors text-sm text-white ${
              danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-yellow-600 hover:bg-yellow-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  nodes: Map<number, MeshNode>;
  messageCount: number;
  onReboot: (seconds: number) => Promise<void>;
  onShutdown: (seconds: number) => Promise<void>;
  onFactoryReset: () => Promise<void>;
  onResetNodeDb: () => Promise<void>;
  onTraceRoute: (destination: number) => Promise<void>;
  onRemoveNode: (nodeNum: number) => Promise<void>;
  isConnected: boolean;
}

interface PendingAction {
  name: string;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => Promise<void>;
}

export default function AdminPanel({
  nodes,
  messageCount,
  onReboot,
  onShutdown,
  onFactoryReset,
  onResetNodeDb,
  onTraceRoute,
  onRemoveNode,
  isConnected,
}: Props) {
  const [targetNode, setTargetNode] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const { addToast } = useToast();

  const executeWithConfirmation = useCallback(
    (action: PendingAction) => {
      setPendingAction(action);
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;
    setPendingAction(null);
    try {
      await pendingAction.action();
      addToast(`${pendingAction.name} command sent successfully.`, "success");
    } catch (err) {
      addToast(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    }
  }, [pendingAction, addToast]);

  const getTargetNodeNum = (): number => {
    if (!targetNode) return 0;
    const parsed = targetNode.startsWith("!")
      ? parseInt(targetNode.slice(1), 16)
      : parseInt(targetNode, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-200">Administration</h2>

      {!isConnected && (
        <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 px-4 py-2 rounded-lg text-sm">
          Connect to a device to use admin commands.
        </div>
      )}

      {/* Target Node */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">
          Target Node (leave empty for self)
        </label>
        <input
          type="text"
          value={targetNode}
          onChange={(e) => setTargetNode(e.target.value)}
          disabled={!isConnected}
          placeholder="!aabbccdd or node number"
          className="w-full px-3 py-2 bg-gray-700 rounded-lg text-gray-200 border border-gray-600 focus:border-green-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* Device Commands */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">Device Commands (affects connected device)</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() =>
              executeWithConfirmation({
                name: "Reboot",
                title: "Reboot Device",
                message:
                  "This will reboot the connected Meshtastic device. It will briefly go offline during restart.",
                confirmLabel: "Reboot",
                action: () => onReboot(2),
              })
            }
            disabled={!isConnected}
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Reboot
          </button>

          <button
            onClick={() =>
              executeWithConfirmation({
                name: "Shutdown",
                title: "Shutdown Device",
                message:
                  "This will power off the connected device. You will need to physically power it back on.",
                confirmLabel: "Shutdown",
                action: () => onShutdown(2),
              })
            }
            disabled={!isConnected}
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Shutdown
          </button>

          <button
            onClick={() =>
              executeWithConfirmation({
                name: "Reset NodeDB",
                title: "Reset Node Database",
                message:
                  "This will clear the device's internal node database. The device will re-discover nodes over time.",
                confirmLabel: "Reset NodeDB",
                action: () => onResetNodeDb(),
              })
            }
            disabled={!isConnected}
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Reset NodeDB
          </button>

          <button
            onClick={() =>
              executeWithConfirmation({
                name: "Factory Reset",
                title: "⚠ Factory Reset",
                message:
                  "This will erase ALL device settings and restore factory defaults. All channels, configuration, and stored data on the device will be permanently lost. This action CANNOT be undone.",
                confirmLabel: "Factory Reset",
                danger: true,
                action: () => onFactoryReset(),
              })
            }
            disabled={!isConnected}
            className="px-4 py-3 bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-800 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Factory Reset
          </button>
        </div>
      </div>

      {/* Trace Route */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">
          Network Diagnostics
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              const target = getTargetNodeNum();
              if (target) {
                onTraceRoute(target)
                  .then(() => addToast("Trace route request sent.", "info"))
                  .catch((err) =>
                    addToast(
                      `Trace route failed: ${err instanceof Error ? err.message : "Unknown error"}`,
                      "error"
                    )
                  );
              } else {
                addToast("Enter a target node for trace route.", "warning");
              }
            }}
            disabled={!isConnected || !targetNode}
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Trace Route
          </button>

          <button
            onClick={() => {
              const target = getTargetNodeNum();
              if (target) {
                executeWithConfirmation({
                  name: "Remove Node",
                  title: "Remove Node",
                  message: `Remove node !${target.toString(16)} from the device's node database? The node may reappear if it broadcasts again.`,
                  confirmLabel: "Remove",
                  action: () => onRemoveNode(target),
                });
              } else {
                addToast("Enter a target node to remove.", "warning");
              }
            }}
            disabled={!isConnected || !targetNode}
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Remove Node
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">
          Data Management
        </h3>
        <p className="text-xs text-gray-500">
          Export your local database (messages &amp; nodes) as a .db file, or
          import/merge another user's database into yours.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={async () => {
              try {
                const path = await window.electronAPI.db.exportDb();
                if (path) {
                  addToast(`Exported to: ${path}`, "success");
                }
              } catch (err) {
                addToast(
                  `Export failed: ${
                    err instanceof Error ? err.message : "Unknown error"
                  }`,
                  "error"
                );
              }
            }}
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Export Database
          </button>

          <button
            onClick={async () => {
              try {
                const result = await window.electronAPI.db.importDb();
                if (result) {
                  addToast(
                    `Merged: ${result.nodesAdded} new nodes, ${result.messagesAdded} new messages.`,
                    "success"
                  );
                }
              } catch (err) {
                addToast(
                  `Import failed: ${
                    err instanceof Error ? err.message : "Unknown error"
                  }`,
                  "error"
                );
              }
            }}
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Import &amp; Merge
          </button>
        </div>
      </div>

      {/* Local Database Actions */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">
          Local Database
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() =>
              executeWithConfirmation({
                name: "Clear Messages",
                title: "Clear Messages",
                message: `This will permanently delete all ${messageCount} locally stored messages. This cannot be undone.`,
                confirmLabel: `Clear ${messageCount} Messages`,
                danger: true,
                action: async () => {
                  await window.electronAPI.db.clearMessages();
                },
              })
            }
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Clear Messages ({messageCount})
          </button>

          <button
            onClick={() =>
              executeWithConfirmation({
                name: "Clear Nodes",
                title: "Clear Nodes",
                message: `This will permanently delete all ${nodes.size} locally stored nodes. They will be re-discovered when connected.`,
                confirmLabel: `Clear ${nodes.size} Nodes`,
                danger: true,
                action: async () => {
                  await window.electronAPI.db.clearNodes();
                },
              })
            }
            className="px-4 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Clear Nodes ({nodes.size})
          </button>

          <button
            onClick={() =>
              executeWithConfirmation({
                name: "Clear All Data",
                title: "⚠ Clear All Local Data",
                message:
                  "This will permanently delete ALL local messages, nodes, and cached session data. This action CANNOT be undone.",
                confirmLabel: "Clear Everything",
                danger: true,
                action: async () => {
                  await window.electronAPI.db.clearMessages();
                  await window.electronAPI.db.clearNodes();
                  await window.electronAPI.clearSessionData();
                },
              })
            }
            className="col-span-2 px-4 py-3 bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-800 rounded-lg text-sm font-medium transition-colors"
          >
            Clear All Local Data &amp; Cache
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-red-900/20 border border-red-900 rounded-lg p-4 text-sm text-red-400 space-y-1">
        <p className="font-medium">Warning</p>
        <p>
          Factory Reset will erase all device settings and restore defaults.
          This action cannot be undone.
        </p>
      </div>

      {/* Confirmation Modal */}
      {pendingAction && (
        <ConfirmModal
          title={pendingAction.title}
          message={pendingAction.message}
          confirmLabel={pendingAction.confirmLabel}
          danger={pendingAction.danger}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
