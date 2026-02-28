import { useState, useMemo } from "react";
import type { MeshNode } from "../lib/types";
import { getNodeStatus } from "../lib/nodeStatus";
import RefreshButton from "./RefreshButton";

type SortField =
  | "node_id"
  | "long_name"
  | "short_name"
  | "snr"
  | "battery"
  | "last_heard"
  | "latitude"
  | "longitude"
  | "role"
  | "hops_away"
  | "via_mqtt"
  | "voltage"
  | "channel_utilization"
  | "air_util_tx"
  | "altitude";

interface Props {
  nodes: Map<number, MeshNode>;
  myNodeNum: number;
  onRequestPosition: (nodeNum: number) => Promise<void>;
  onTraceRoute: (nodeNum: number) => Promise<void>;
  onRefresh: () => Promise<void>;
  onNodeClick: (node: MeshNode) => void;
  isConnected: boolean;
  onMessageNode?: (nodeNum: number) => void;
}

export default function NodeListPanel({
  nodes,
  myNodeNum,
  onRequestPosition,
  onTraceRoute,
  onRefresh,
  onNodeClick,
  isConnected,
  onMessageNode,
}: Props) {
  const [sortField, setSortField] = useState<SortField>("last_heard");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "long_name" || field === "short_name" || field === "role"); // text asc, numbers desc
    }
  };

  const nodeList = useMemo(() => {
    let list = Array.from(nodes.values());

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.long_name.toLowerCase().includes(q) ||
          n.short_name.toLowerCase().includes(q) ||
          n.node_id.toString(16).includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "node_id":
          cmp = a.node_id - b.node_id;
          break;
        case "long_name":
          cmp = (a.long_name || "").localeCompare(b.long_name || "");
          break;
        case "short_name":
          cmp = (a.short_name || "").localeCompare(b.short_name || "");
          break;
        case "snr":
          cmp = (a.snr || -999) - (b.snr || -999);
          break;
        case "battery":
          cmp = (a.battery || 0) - (b.battery || 0);
          break;
        case "last_heard":
          cmp = (a.last_heard || 0) - (b.last_heard || 0);
          break;
        case "latitude":
          cmp = (a.latitude || 0) - (b.latitude || 0);
          break;
        case "longitude":
          cmp = (a.longitude || 0) - (b.longitude || 0);
          break;
        case "role":
          cmp = (a.role || "").localeCompare(b.role || "");
          break;
        case "hops_away":
          cmp = (a.hops_away ?? 999) - (b.hops_away ?? 999);
          break;
        case "via_mqtt":
          cmp = (a.via_mqtt ? 1 : 0) - (b.via_mqtt ? 1 : 0);
          break;
        case "voltage":
          cmp = (a.voltage ?? 0) - (b.voltage ?? 0);
          break;
        case "channel_utilization":
          cmp = (a.channel_utilization ?? 0) - (b.channel_utilization ?? 0);
          break;
        case "air_util_tx":
          cmp = (a.air_util_tx ?? 0) - (b.air_util_tx ?? 0);
          break;
        case "altitude":
          cmp = (a.altitude ?? 0) - (b.altitude ?? 0);
          break;
      }
      // Self-node always first
      if (a.node_id === myNodeNum) return -1;
      if (b.node_id === myNodeNum) return 1;
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [nodes, sortField, sortAsc, searchQuery, myNodeNum]);

  function formatTime(ts: number): string {
    if (!ts) return "Never";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function formatCoord(val: number): string {
    return val === 0 ? "-" : val.toFixed(4);
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 text-gray-600 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 text-green-400 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={sortAsc ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-200">
          Node Database ({nodeList.length})
        </h2>
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="flex-1 px-3 py-1.5 bg-gray-700/80 rounded-lg text-gray-200 text-sm border border-gray-600/50 focus:border-green-500/50 focus:outline-none"
          />
        </div>
        <RefreshButton onRefresh={onRefresh} disabled={!isConnected} />
      </div>

      {/* Online / Stale / Offline summary */}
      <div className="flex gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {nodeList.filter((n) => getNodeStatus(n.last_heard) === "online").length} online
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
          {nodeList.filter((n) => getNodeStatus(n.last_heard) === "stale").length} stale
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />
          {nodeList.filter((n) => getNodeStatus(n.last_heard) === "offline").length} offline
        </span>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-left sticky top-0 z-10">
              <th className="px-3 py-2 w-8"></th>
              <th
                className="px-3 py-2 cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("node_id")}
              >
                ID <SortIcon field="node_id" />
              </th>
              <th
                className="px-3 py-2 cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("long_name")}
              >
                Long Name <SortIcon field="long_name" />
              </th>
              <th
                className="px-3 py-2 cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("short_name")}
              >
                Short <SortIcon field="short_name" />
              </th>
              <th
                className="px-3 py-2 cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("last_heard")}
              >
                Last Heard <SortIcon field="last_heard" />
              </th>
              <th
                className="px-3 py-2 cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("role")}
              >
                Role <SortIcon field="role" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("hops_away")}
              >
                Hops <SortIcon field="hops_away" />
              </th>
              <th
                className="px-3 py-2 text-center cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("via_mqtt")}
              >
                MQTT <SortIcon field="via_mqtt" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("latitude")}
              >
                Lat <SortIcon field="latitude" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("longitude")}
              >
                Lon <SortIcon field="longitude" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("snr")}
              >
                SNR <SortIcon field="snr" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("battery")}
              >
                Battery <SortIcon field="battery" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("voltage")}
              >
                Voltage <SortIcon field="voltage" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("channel_utilization")}
              >
                Ch.Util <SortIcon field="channel_utilization" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("air_util_tx")}
              >
                Air Tx <SortIcon field="air_util_tx" />
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-200 transition-colors select-none"
                onClick={() => handleSort("altitude")}
              >
                Alt <SortIcon field="altitude" />
              </th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {nodeList.length === 0 ? (
              <tr>
                <td
                  colSpan={17}
                  className="text-center text-gray-500 py-8"
                >
                  {searchQuery
                    ? "No nodes match your search."
                    : "No nodes discovered yet. Connect to a device to see the mesh network."}
                </td>
              </tr>
            ) : (
              nodeList.map((node) => {
                const isSelf = node.node_id === myNodeNum;
                const status = getNodeStatus(node.last_heard);
                const rowOpacity =
                  status === "offline"
                    ? "opacity-40"
                    : status === "stale"
                    ? "opacity-70"
                    : "";

                return (
                  <tr
                    key={node.node_id}
                    onClick={() => onNodeClick(node)}
                    className={`cursor-pointer hover:bg-gray-700/50 transition-colors ${rowOpacity} ${
                      isSelf
                        ? "bg-green-900/10 border-l-2 border-l-green-500"
                        : ""
                    }`}
                  >
                    {/* Status indicator */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            status === "online"
                              ? "bg-green-500"
                              : status === "stale"
                              ? "bg-yellow-500"
                              : "bg-gray-600"
                          }`}
                          title={status}
                        />
                        {isSelf && (
                          <span className="text-[10px] text-green-500 font-bold" title="This is your node">
                            ★
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-400">
                      !{node.node_id.toString(16)}
                    </td>
                    <td className={`px-3 py-2 ${isSelf ? "text-green-300 font-medium" : "text-gray-200"}`}>
                      {node.long_name || "-"}
                      {isSelf && (
                        <span className="text-[10px] text-green-500/60 ml-1.5">(you)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-300">
                      {node.short_name || "-"}
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {formatTime(node.last_heard)}
                    </td>
                    <td className="px-3 py-2 text-gray-300 text-xs">
                      {node.role ?? "-"}
                    </td>
                    <td className={`px-3 py-2 text-right text-xs ${node.hops_away === 0 ? "text-green-400" : "text-gray-300"}`}>
                      {node.hops_away !== undefined ? node.hops_away : "-"}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-300 text-xs">
                      {node.via_mqtt ? "Yes" : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                      {formatCoord(node.latitude)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                      {formatCoord(node.longitude)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {node.snr ? `${node.snr.toFixed(1)} dB` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {node.battery > 0 && (
                          <div className="w-10 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                node.battery > 50
                                  ? "bg-green-500"
                                  : node.battery > 20
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{
                                width: `${Math.min(node.battery, 100)}%`,
                              }}
                            />
                          </div>
                        )}
                        <span
                          className={
                            node.battery > 50
                              ? "text-green-400"
                              : node.battery > 20
                              ? "text-yellow-400"
                              : node.battery > 0
                              ? "text-red-400"
                              : "text-gray-500"
                          }
                        >
                          {node.battery > 0 ? `${node.battery}%` : "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300 text-xs">
                      {node.voltage != null ? `${node.voltage.toFixed(2)} V` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300 text-xs">
                      {node.channel_utilization != null ? `${node.channel_utilization.toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300 text-xs">
                      {node.air_util_tx != null ? `${node.air_util_tx.toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300 text-xs">
                      {node.altitude != null && node.altitude !== 0 ? `${node.altitude} m` : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestPosition(node.node_id);
                          }}
                          disabled={!isConnected}
                          title="Request Position"
                          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                        >
                          Pos
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTraceRoute(node.node_id);
                          }}
                          disabled={!isConnected}
                          title="Trace Route"
                          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                        >
                          Route
                        </button>
                        {onMessageNode && !isSelf && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMessageNode(node.node_id);
                            }}
                            disabled={!isConnected}
                            title="Direct Message"
                            className="px-2 py-1 text-xs bg-purple-700/50 hover:bg-purple-600/50 text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                          >
                            Msg
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
