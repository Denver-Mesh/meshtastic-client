import { useState, useCallback, useEffect } from "react";
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
      <div className="relative bg-deep-black border border-gray-600 rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-200">{title}</h3>
        <p className="text-sm text-muted leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-secondary-dark hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors text-sm"
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

// ─── Admin Settings ─────────────────────────────────────────────
interface AdminSettings {
  autoPruneEnabled: boolean;
  autoPruneDays: number;
  nodeCapEnabled: boolean;
  nodeCapCount: number;
}

const DEFAULT_SETTINGS: AdminSettings = {
  autoPruneEnabled: false,
  autoPruneDays: 30,
  nodeCapEnabled: true,
  nodeCapCount: 10000,
};

function loadSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem("electastic:adminSettings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface Props {
  nodes: Map<number, MeshNode>;
  messageCount: number;
  channels: Array<{ index: number; name: string }>;
  onReboot: (seconds: number) => Promise<void>;
  onShutdown: (seconds: number) => Promise<void>;
  onFactoryReset: () => Promise<void>;
  onResetNodeDb: () => Promise<void>;
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
  channels,
  onReboot,
  onShutdown,
  onFactoryReset,
  onResetNodeDb,
  isConnected,
}: Props) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const { addToast } = useToast();

  // ─── Node retention settings ────────────────────────────────
  const [settings, setSettings] = useState<AdminSettings>(loadSettings);
  const [deleteAgeDays, setDeleteAgeDays] = useState(90);

  useEffect(() => {
    localStorage.setItem("electastic:adminSettings", JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  // ─── Message channel selection ──────────────────────────────
  const [msgChannels, setMsgChannels] = useState<number[]>([]);
  const [clearChannelTarget, setClearChannelTarget] = useState<number>(-1);

  useEffect(() => {
    window.electronAPI.db.getMessageChannels().then((rows) => {
      setMsgChannels(rows.map((r) => r.channel));
    }).catch(() => {});
  }, []);

  const getChannelLabel = (ch: number) => {
    const named = channels.find((c) => c.index === ch);
    return named ? `Channel ${ch} — ${named.name}` : `Channel ${ch}`;
  };

  // ─── Confirmation flow ──────────────────────────────────────
  const executeWithConfirmation = useCallback((action: PendingAction) => {
    setPendingAction(action);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;
    setPendingAction(null);
    try {
      await pendingAction.action();
      addToast(`${pendingAction.name} completed successfully.`, "success");
    } catch (err) {
      addToast(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    }
  }, [pendingAction, addToast]);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-200">Administration</h2>

      {!isConnected && (
        <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 px-4 py-2 rounded-lg text-sm">
          Connect to a device to use admin commands.
        </div>
      )}

      {/* Device Commands */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted">Device Commands (affects connected device)</h3>
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
            className="px-4 py-3 bg-secondary-dark text-gray-300 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
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
            className="px-4 py-3 bg-secondary-dark text-gray-300 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
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
            className="px-4 py-3 bg-secondary-dark text-gray-300 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Reset NodeDB
          </button>

        </div>
      </div>

      {/* Node Retention */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted">Node Retention</h3>
        <div className="bg-secondary-dark rounded-lg p-4 space-y-4">
          {/* Manual age delete */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300 flex-1">Delete nodes last heard more than</span>
            <input
              type="number"
              min={1}
              value={deleteAgeDays}
              onChange={(e) => setDeleteAgeDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-2 py-1 bg-deep-black border border-gray-600 rounded text-gray-200 text-sm text-right focus:border-brand-green focus:outline-none"
            />
            <span className="text-sm text-gray-300">days ago</span>
            <button
              onClick={() =>
                executeWithConfirmation({
                  name: "Delete Old Nodes",
                  title: "Delete Old Nodes",
                  message: `This will permanently delete all nodes that haven't been heard in the last ${deleteAgeDays} day${deleteAgeDays !== 1 ? "s" : ""}. They will be re-discovered when they broadcast again.`,
                  confirmLabel: "Delete Old Nodes",
                  danger: true,
                  action: async () => {
                    await window.electronAPI.db.deleteNodesByAge(deleteAgeDays);
                  },
                })
              }
              className="px-3 py-1.5 bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-800 rounded text-sm font-medium transition-colors whitespace-nowrap"
            >
              Delete Old Nodes
            </button>
          </div>

          {/* Auto-prune on startup */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoPrune"
              checked={settings.autoPruneEnabled}
              onChange={(e) => updateSetting("autoPruneEnabled", e.target.checked)}
              className="accent-brand-green"
            />
            <label htmlFor="autoPrune" className="text-sm text-gray-300 flex-1 cursor-pointer">
              Auto-prune on startup, older than
            </label>
            <input
              type="number"
              min={1}
              value={settings.autoPruneDays}
              onChange={(e) => updateSetting("autoPruneDays", Math.max(1, parseInt(e.target.value) || 1))}
              disabled={!settings.autoPruneEnabled}
              className="w-20 px-2 py-1 bg-deep-black border border-gray-600 rounded text-gray-200 text-sm text-right focus:border-brand-green focus:outline-none disabled:opacity-40"
            />
            <span className="text-sm text-gray-300">days</span>
          </div>

          {/* Node cap */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="nodeCap"
              checked={settings.nodeCapEnabled}
              onChange={(e) => updateSetting("nodeCapEnabled", e.target.checked)}
              className="accent-brand-green"
            />
            <label htmlFor="nodeCap" className="text-sm text-gray-300 flex-1 cursor-pointer">
              Cap total nodes, keep newest
            </label>
            <input
              type="number"
              min={1}
              value={settings.nodeCapCount}
              onChange={(e) => updateSetting("nodeCapCount", Math.max(1, parseInt(e.target.value) || 1))}
              disabled={!settings.nodeCapEnabled}
              className="w-24 px-2 py-1 bg-deep-black border border-gray-600 rounded text-gray-200 text-sm text-right focus:border-brand-green focus:outline-none disabled:opacity-40"
            />
            <span className="text-sm text-gray-300">nodes</span>
          </div>

          {/* Clear all nodes */}
          <div className="pt-1 border-t border-gray-700">
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
              className="w-full px-4 py-2.5 bg-secondary-dark text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              Clear All Nodes ({nodes.size})
            </button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted">
          Data Management
        </h3>
        <p className="text-xs text-muted">
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
            className="px-4 py-3 bg-secondary-dark text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
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
            className="px-4 py-3 bg-secondary-dark text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Import &amp; Merge
          </button>
        </div>
      </div>

      {/* Message Management */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted">
          Message Management
        </h3>

        {/* Channel-scoped message deletion */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Channel:</label>
            <select
              value={clearChannelTarget}
              onChange={(e) => setClearChannelTarget(parseInt(e.target.value))}
              className="flex-1 px-3 py-1.5 bg-secondary-dark border border-gray-600 rounded-lg text-gray-200 text-sm focus:border-brand-green focus:outline-none"
            >
              <option value={-1}>All Channels</option>
              {msgChannels.map((ch) => (
                <option key={ch} value={ch}>
                  {getChannelLabel(ch)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            const isAll = clearChannelTarget === -1;
            const channelName = isAll ? "" : getChannelLabel(clearChannelTarget);
            executeWithConfirmation({
              name: "Clear Messages",
              title: "Clear Messages",
              message: isAll
                ? `This will permanently delete all ${messageCount} locally stored messages across all channels. This cannot be undone.`
                : `This will permanently delete all messages from ${channelName}. This cannot be undone.`,
              confirmLabel: isAll ? `Clear ${messageCount} Messages` : `Clear ${channelName}`,
              danger: true,
              action: async () => {
                if (isAll) {
                  await window.electronAPI.db.clearMessages();
                } else {
                  await window.electronAPI.db.clearMessagesByChannel(clearChannelTarget);
                }
              },
            });
          }}
          className="w-full px-4 py-3 bg-secondary-dark text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
        >
          Clear Messages ({messageCount})
        </button>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
        <div className="border border-red-900 rounded-lg p-4 space-y-2">
          <p className="text-xs text-red-400/80">
            These actions are permanent and cannot be undone.
          </p>
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
            className="w-full px-4 py-3 bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-800 rounded-lg text-sm font-medium transition-colors"
          >
            Clear All Local Data &amp; Cache
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
            className="w-full px-4 py-3 bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-800 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Factory Reset Device
          </button>
        </div>
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
