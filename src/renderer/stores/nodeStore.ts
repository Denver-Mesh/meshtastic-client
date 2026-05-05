import { create } from 'zustand';

import type {
  NodeInfoEvent,
  PositionEvent,
  TelemetryEvent,
  TraceRouteEvent,
  WaypointEvent,
} from '../lib/protocols/Protocol';
import type { IdentityId } from '../lib/types';

export interface NodeRecord {
  nodeId: number;
  // From NodeInfo
  longName?: string;
  shortName?: string;
  macAddr?: string;
  hwModel?: string;
  isLicensed?: boolean;
  role?: number;
  lastHeardAt?: number;
  // From Position
  latitude?: number;
  longitude?: number;
  altitude?: number;
  positionTimestamp?: number;
  groundSpeed?: number;
  groundTrack?: number;
  // From Telemetry
  batteryLevel?: number;
  voltage?: number;
  channelUtilization?: number;
  airUtilTx?: number;
  uptimeSeconds?: number;
  temperature?: number;
  relativeHumidity?: number;
  barometricPressure?: number;
  iaq?: number;
  telemetryTimestamp?: number;
}

interface NodeStoreState {
  nodes: Record<IdentityId, Record<number, NodeRecord>>;
  traceRoutes: Record<IdentityId, TraceRouteEvent[]>;
  waypoints: Record<IdentityId, Record<number, WaypointEvent>>;
}

const defaultState: NodeStoreState = {
  nodes: {},
  traceRoutes: {},
  waypoints: {},
};

export const useNodeStore = create<NodeStoreState>()(() => defaultState);

function mergeNode(
  existing: NodeRecord | undefined,
  nodeId: number,
  patch: Partial<NodeRecord>,
): NodeRecord {
  return { ...(existing ?? { nodeId }), ...patch };
}

export function upsertNode(identityId: IdentityId, event: NodeInfoEvent): void {
  useNodeStore.setState((s) => {
    const byId = s.nodes[identityId] ?? {};
    const { nodeId, longName, shortName, macAddr, hwModel, isLicensed, role, lastHeardAt } = event;
    return {
      nodes: {
        ...s.nodes,
        [identityId]: {
          ...byId,
          [nodeId]: mergeNode(byId[nodeId], nodeId, {
            longName,
            shortName,
            macAddr,
            hwModel,
            isLicensed,
            role,
            lastHeardAt,
          }),
        },
      },
    };
  });
}

export function updatePosition(identityId: IdentityId, event: PositionEvent): void {
  useNodeStore.setState((s) => {
    const byId = s.nodes[identityId] ?? {};
    const { nodeId, latitude, longitude, altitude, timestamp, groundSpeed, groundTrack } = event;
    return {
      nodes: {
        ...s.nodes,
        [identityId]: {
          ...byId,
          [nodeId]: mergeNode(byId[nodeId], nodeId, {
            latitude,
            longitude,
            altitude,
            positionTimestamp: timestamp,
            groundSpeed,
            groundTrack,
          }),
        },
      },
    };
  });
}

export function updateTelemetry(identityId: IdentityId, event: TelemetryEvent): void {
  useNodeStore.setState((s) => {
    const byId = s.nodes[identityId] ?? {};
    const {
      nodeId,
      timestamp,
      batteryLevel,
      voltage,
      channelUtilization,
      airUtilTx,
      uptimeSeconds,
      temperature,
      relativeHumidity,
      barometricPressure,
      iaq,
    } = event;
    return {
      nodes: {
        ...s.nodes,
        [identityId]: {
          ...byId,
          [nodeId]: mergeNode(byId[nodeId], nodeId, {
            batteryLevel,
            voltage,
            channelUtilization,
            airUtilTx,
            uptimeSeconds,
            temperature,
            relativeHumidity,
            barometricPressure,
            iaq,
            telemetryTimestamp: timestamp,
          }),
        },
      },
    };
  });
}

export function addTraceRoute(identityId: IdentityId, event: TraceRouteEvent): void {
  useNodeStore.setState((s) => ({
    traceRoutes: {
      ...s.traceRoutes,
      [identityId]: [...(s.traceRoutes[identityId] ?? []), event],
    },
  }));
}

export function upsertWaypoint(identityId: IdentityId, event: WaypointEvent): void {
  useNodeStore.setState((s) => ({
    waypoints: {
      ...s.waypoints,
      [identityId]: { ...(s.waypoints[identityId] ?? {}), [event.id]: event },
    },
  }));
}

export function clearNodeIdentity(identityId: IdentityId): void {
  useNodeStore.setState((s) => {
    const { [identityId]: _n, ...nodes } = s.nodes;
    const { [identityId]: _t, ...traceRoutes } = s.traceRoutes;
    const { [identityId]: _w, ...waypoints } = s.waypoints;
    return { nodes, traceRoutes, waypoints };
  });
}
