import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { MeshNode } from "../lib/types";
import { getNodeStatus } from "../lib/nodeStatus";
import RefreshButton from "./RefreshButton";

// Create colored marker icons using SVG data URIs
function createMarkerIcon(color: string, isSelf: boolean): L.Icon {
  const size = isSelf ? 32 : 25;
  const anchor = isSelf ? 16 : 12;

  // Star marker for self
  if (isSelf) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="#000" stroke-width="0.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    return L.icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
      popupAnchor: [0, -anchor],
    });
  }

  // Circle marker for others
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}" stroke="#000" stroke-width="1" opacity="0.9"/><circle cx="12" cy="12" r="4" fill="#fff" opacity="0.8"/></svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -anchor],
  });
}

// Cached marker icons
const MARKERS = {
  selfOnline: createMarkerIcon("#9ae6b4", true),
  selfStale: createMarkerIcon("#eab308", true),
  selfOffline: createMarkerIcon("#6b7280", true),
  online: createMarkerIcon("#9ae6b4", false),
  stale: createMarkerIcon("#eab308", false),
  offline: createMarkerIcon("#6b7280", false),
};

function getMarkerIcon(status: "online" | "stale" | "offline", isSelf: boolean): L.Icon {
  if (isSelf) {
    return status === "online"
      ? MARKERS.selfOnline
      : status === "stale"
      ? MARKERS.selfStale
      : MARKERS.selfOffline;
  }
  return status === "online"
    ? MARKERS.online
    : status === "stale"
    ? MARKERS.stale
    : MARKERS.offline;
}

interface Props {
  nodes: Map<number, MeshNode>;
  myNodeNum: number;
  onRefresh: () => Promise<void>;
  isConnected: boolean;
}

// Default center: Longmont, CO (same as Joey's original)
const DEFAULT_CENTER: [number, number] = [40.1672, -105.1019];
const DEFAULT_ZOOM = 12;

// Auto-fit map to show all nodes
function MapFitter({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.flyTo(positions[0], map.getZoom());
    } else {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => L.latLng(lat, lng)));
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [positions.length, map]); // only re-fit when count changes
  return null;
}

export default function MapPanel({ nodes, myNodeNum, onRefresh, isConnected }: Props) {
  const nodesWithPosition = useMemo(
    () =>
      Array.from(nodes.values()).filter(
        (n) => n.latitude !== 0 && n.longitude !== 0
      ),
    [nodes]
  );

  const positions = useMemo<[number, number][]>(
    () => nodesWithPosition.map((n) => [n.latitude, n.longitude]),
    [nodesWithPosition]
  );

  // Center on nodes if we have positions, otherwise default
  const center: [number, number] =
    nodesWithPosition.length > 0
      ? [nodesWithPosition[0].latitude, nodesWithPosition[0].longitude]
      : DEFAULT_CENTER;

  function formatTime(ts: number): string {
    if (!ts) return "Never";
    return new Date(ts).toLocaleString();
  }

  const statusCounts = useMemo(() => {
    const counts = { online: 0, stale: 0, offline: 0 };
    for (const n of nodesWithPosition) {
      counts[getNodeStatus(n.last_heard)]++;
    }
    return counts;
  }, [nodesWithPosition]);

  return (
    <div className="h-full min-h-[500px] rounded-lg overflow-hidden border border-gray-700 relative">
      {/* Controls overlay — top right */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
        {/* Legend */}
        <div className="bg-deep-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs border border-gray-700">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-brand-green inline-block" />
            {statusCounts.online}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
            {statusCounts.stale}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
            {statusCounts.offline}
          </span>
        </div>
        <div className="bg-deep-black/70 rounded-full">
          <RefreshButton onRefresh={onRefresh} disabled={!isConnected} />
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
      >
        <MapFitter positions={positions} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {nodesWithPosition.map((node) => {
          const isSelf = node.node_id === myNodeNum;
          const status = getNodeStatus(node.last_heard);
          const icon = getMarkerIcon(status, isSelf);

          return (
            <Marker
              key={node.node_id}
              position={[node.latitude, node.longitude]}
              icon={icon}
              zIndexOffset={isSelf ? 1000 : 0}
            >
              <Popup>
                <div className="text-gray-900 text-sm space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    {isSelf && <span title="Your node">★</span>}
                    {node.long_name || `!${node.node_id.toString(16)}`}
                  </div>
                  {node.short_name && (
                    <div className="text-gray-600">{node.short_name}</div>
                  )}
                  <div className="flex items-center gap-1 text-xs">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        status === "online"
                          ? "bg-brand-green"
                          : status === "stale"
                          ? "bg-yellow-500"
                          : "bg-gray-400"
                      }`}
                    />
                    <span className="capitalize">{status}</span>
                  </div>
                  {node.battery > 0 && <div>Battery: {node.battery}%</div>}
                  {node.snr !== 0 && (
                    <div>SNR: {node.snr.toFixed(1)} dB</div>
                  )}
                  <div>Last heard: {formatTime(node.last_heard)}</div>
                  <div className="text-xs text-muted">
                    {node.latitude.toFixed(5)}, {node.longitude.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {nodesWithPosition.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-deep-black/80 px-4 py-2 rounded-lg text-muted text-sm">
            No nodes with GPS positions yet
          </div>
        </div>
      )}
    </div>
  );
}
