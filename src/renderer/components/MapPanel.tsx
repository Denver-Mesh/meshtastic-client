import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, Fragment } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import type { MeshNode } from "../lib/types";
import { getNodeStatus, haversineDistanceKm } from "../lib/nodeStatus";
import RefreshButton from "./RefreshButton";
import type { LocationFilter } from "../App";

function getCUColor(cu: number): string {
  if (cu < 15) return "#22c55e";
  if (cu < 31) return "#eab308";
  if (cu < 51) return "#f97316";
  return "#ef4444";
}

// Create colored marker icons using SVG data URIs, with optional CU halo and MQTT badge
function createMarkerIcon(color: string, isSelf: boolean, cu: number = 0, markerOpacity: number = 1, isMqttOnly: boolean = false): L.Icon {
  const haloPx = cu <= 0 ? 0 : Math.round((cu / 100) * 14);
  const haloColor = getCUColor(cu);
  const halo = (c: number) =>
    haloPx > 0
      ? `<circle cx="${c}" cy="${c}" r="${c - 0.5}" fill="${haloColor}" opacity="0.4"/>`
      : "";
  const mqttBadge = (c: number) =>
    isMqttOnly ? `<circle cx="${c + 7}" cy="${c - 7}" r="4" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>` : "";

  // Star marker for self
  if (isSelf) {
    const total = 32 + 2 * haloPx;
    const c = total / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" opacity="${markerOpacity}">${halo(c)}<g transform="translate(${haloPx},${haloPx}) scale(${32 / 24})"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="${color}" stroke="#000" stroke-width="0.5"/></g>${mqttBadge(c)}</svg>`;
    return L.icon({
      iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      iconSize: [total, total],
      iconAnchor: [c, c],
      popupAnchor: [0, -c],
    });
  }

  // Circle marker for others
  const total = 25 + 2 * haloPx;
  const c = total / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" opacity="${markerOpacity}">${halo(c)}<circle cx="${c}" cy="${c}" r="10.4" fill="${color}" stroke="#000" stroke-width="1" opacity="0.9"/><circle cx="${c}" cy="${c}" r="4.2" fill="#fff" opacity="0.8"/>${mqttBadge(c)}</svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize: [total, total],
    iconAnchor: [c, c],
    popupAnchor: [0, -c],
  });
}

function getMarkerIcon(
  status: "online" | "stale" | "offline",
  isSelf: boolean,
  cu: number,
  isMqttOnly: boolean = false
): L.Icon {
  const color =
    status === "online" ? "#9ae6b4" : status === "stale" ? "#c4a864" : "#6b7280";
  const opacity = status === "online" ? 1 : status === "stale" ? 0.65 : 0.45;
  return createMarkerIcon(color, isSelf, cu, opacity, isMqttOnly);
}

interface Props {
  nodes: Map<number, MeshNode>;
  myNodeNum: number;
  onRefresh: () => Promise<void>;
  isConnected: boolean;
  locationFilter: LocationFilter;
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

export default function MapPanel({ nodes, myNodeNum, onRefresh, isConnected, locationFilter }: Props) {
  const nodesWithPosition = useMemo(() => {
    const homeNode = myNodeNum ? nodes.get(myNodeNum) : undefined;
    const homeHasLocation = homeNode &&
      homeNode.latitude != null && homeNode.latitude !== 0 &&
      homeNode.longitude != null && homeNode.longitude !== 0;
    const maxKm = locationFilter.unit === "miles"
      ? locationFilter.maxDistance * 1.60934
      : locationFilter.maxDistance;

    return Array.from(nodes.values()).filter((n) => {
      if (!n.latitude || !n.longitude) return false;
      if (locationFilter.hideMqttOnly && n.heard_via_mqtt_only) return false;
      if (locationFilter.enabled && homeHasLocation) {
        const d = haversineDistanceKm(homeNode!.latitude, homeNode!.longitude, n.latitude, n.longitude);
        if (d > maxKm) return false;
      }
      return true;
    });
  }, [nodes, myNodeNum, locationFilter]);

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
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block opacity-60" />
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
          const cu = locationFilter.congestionHalosEnabled ? (node.channel_utilization ?? 0) : 0;
          const icon = getMarkerIcon(status, isSelf, cu, node.heard_via_mqtt_only);

          return (
            <Fragment key={node.node_id}>
              {locationFilter.congestionHalosEnabled && node.channel_utilization != null && (
                <Circle
                  center={[node.latitude, node.longitude]}
                  radius={300}
                  pathOptions={{
                    color: getCUColor(node.channel_utilization),
                    fillColor: getCUColor(node.channel_utilization),
                    fillOpacity: 0.25,
                    weight: 1,
                    opacity: 0.6,
                  }}
                />
              )}
              <Marker
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
                            ? "bg-amber-500"
                            : "bg-gray-400"
                        }`}
                      />
                      <span className="capitalize">{status}</span>
                    </div>
                    {node.battery > 0 && <div>Battery: {node.battery}%</div>}
                    {!node.heard_via_mqtt_only && node.snr !== 0 && (
                      <div>SNR: {node.snr.toFixed(1)} dB</div>
                    )}
                    {node.heard_via_mqtt_only && (
                      <div className="text-blue-600 text-xs">🌐 Via MQTT</div>
                    )}
                    {node.channel_utilization != null && (
                      <div>Ch. Util: {node.channel_utilization.toFixed(1)}%</div>
                    )}
                    <div>Last heard: {formatTime(node.last_heard)}</div>
                    <div className="text-xs text-muted">
                      {node.latitude.toFixed(5)}, {node.longitude.toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
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
