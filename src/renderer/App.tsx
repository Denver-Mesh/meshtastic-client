import { useState } from "react";
import { useDevice } from "./hooks/useDevice";
import Tabs from "./components/Tabs";
import ErrorBoundary from "./components/ErrorBoundary";
import NodeDetailModal from "./components/NodeDetailModal";
import ConnectionPanel from "./components/ConnectionPanel";
import ChatPanel from "./components/ChatPanel";
import NodeListPanel from "./components/NodeListPanel";
import ConfigPanel from "./components/ConfigPanel";
import MapPanel from "./components/MapPanel";
import TelemetryPanel from "./components/TelemetryPanel";
import AdminPanel from "./components/AdminPanel";

const TAB_NAMES = [
  "Connection",
  "Chat",
  "Nodes",
  "Config",
  "Map",
  "Telemetry",
  "Admin",
];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const device = useDevice();

  const isConfigured = device.state.status === "configured";
  const selectedNode = selectedNodeId
    ? device.nodes.get(selectedNodeId) ?? null
    : null;

  const statusColor = {
    disconnected: "bg-red-500",
    connecting: "bg-yellow-500 animate-pulse",
    connected: "bg-blue-500",
    configured: "bg-green-500",
  }[device.state.status];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className={`flex items-center justify-between px-4 py-2 bg-gray-800 border-b ${
          isConfigured ? "border-green-500/20" : "border-gray-700"
        }`}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-green-400 tracking-wide">
            Electastic
          </h1>
          <span className="text-xs text-gray-500">Meshtastic Client</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm text-gray-400 capitalize">
            {device.state.status}
            {device.state.connectionType
              ? ` (${device.state.connectionType.toUpperCase()})`
              : ""}
          </span>
          {device.state.myNodeNum > 0 && (
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
              Node: {device.getFullNodeLabel(device.state.myNodeNum)}
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <Tabs tabs={TAB_NAMES} active={activeTab} onChange={setActiveTab} />

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">
        <ErrorBoundary>
          {activeTab === 0 && (
            <ConnectionPanel
              state={device.state}
              onConnect={device.connect}
              onDisconnect={device.disconnect}
            />
          )}
          {activeTab === 1 && (
            <ChatPanel
              messages={device.messages}
              channels={device.channels}
              myNodeNum={device.state.myNodeNum}
              onSend={device.sendMessage}
              onReact={device.sendReaction}
              onNodeClick={setSelectedNodeId}
              isConnected={isConfigured}
            />
          )}
          {activeTab === 2 && (
            <NodeListPanel
              nodes={device.nodes}
              onRequestPosition={device.requestPosition}
              onTraceRoute={device.traceRoute}
              onRefresh={device.requestRefresh}
              onNodeClick={(node) => setSelectedNodeId(node.node_id)}
              isConnected={isConfigured}
            />
          )}
          {activeTab === 3 && (
            <ConfigPanel
              onSetConfig={device.setConfig}
              onCommit={device.commitConfig}
              isConnected={isConfigured}
            />
          )}
          {activeTab === 4 && (
            <MapPanel
              nodes={device.nodes}
              onRefresh={device.requestRefresh}
              isConnected={isConfigured}
            />
          )}
          {activeTab === 5 && (
            <TelemetryPanel
              telemetry={device.telemetry}
              onRefresh={device.requestRefresh}
              isConnected={isConfigured}
            />
          )}
          {activeTab === 6 && (
            <AdminPanel
              nodes={device.nodes}
              onReboot={device.reboot}
              onShutdown={device.shutdown}
              onFactoryReset={device.factoryReset}
              onResetNodeDb={device.resetNodeDb}
              onTraceRoute={device.traceRoute}
              isConnected={isConfigured}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="px-4 py-1.5 bg-gray-800 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>
          Inspired by{" "}
          <a
            href="https://github.com/Denver-Mesh/meshtastic_mac_client"
            className="text-green-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Joey (NV0N)
          </a>{" "}
          &amp; Denver Mesh
        </span>
        <span>
          {device.nodes.size} nodes | {device.messages.length} messages
        </span>
      </footer>

      {/* Node Detail Modal — rendered outside main for proper z-indexing */}
      <NodeDetailModal
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onRequestPosition={device.requestPosition}
        onTraceRoute={device.traceRoute}
        isConnected={isConfigured}
      />
    </div>
  );
}
