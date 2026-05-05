import type { ProtocolCapabilities } from '../radio/BaseRadioProvider';

// --- Inbound decoded events ---

export interface TextMessageEvent {
  id: string;
  from: number;
  to: number;
  text: string;
  channelIndex: number;
  timestamp: number;
  rxSnr?: number;
  rxRssi?: number;
  hopCount?: number;
  isTapback?: boolean;
  replyTo?: string;
}

export interface NodeInfoEvent {
  nodeId: number;
  longName?: string;
  shortName?: string;
  macAddr?: string;
  hwModel?: string;
  isLicensed?: boolean;
  role?: number;
  lastHeardAt?: number;
}

export interface PositionEvent {
  nodeId: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp: number;
  groundSpeed?: number;
  groundTrack?: number;
}

export interface TelemetryEvent {
  nodeId: number;
  timestamp: number;
  batteryLevel?: number;
  voltage?: number;
  channelUtilization?: number;
  airUtilTx?: number;
  uptimeSeconds?: number;
  temperature?: number;
  relativeHumidity?: number;
  barometricPressure?: number;
  iaq?: number;
}

export interface TraceRouteEvent {
  from: number;
  to: number;
  route: number[];
  routeBack?: number[];
  timestamp: number;
}

export interface WaypointEvent {
  id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  lockedTo?: number;
  expire?: number;
  from: number;
  timestamp: number;
}

export type DomainEvent =
  | { type: 'text_message'; payload: TextMessageEvent }
  | { type: 'node_info'; payload: NodeInfoEvent }
  | { type: 'position'; payload: PositionEvent }
  | { type: 'telemetry'; payload: TelemetryEvent }
  | { type: 'trace_route'; payload: TraceRouteEvent }
  | { type: 'waypoint'; payload: WaypointEvent };

// --- Outbound send options ---

export interface SendMessageOptions {
  text: string;
  destination?: number;
  channelIndex?: number;
  emoji?: boolean;
  replyTo?: string;
}

export interface SendPositionOptions {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface SendWaypointOptions {
  id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  lockedTo?: number;
  expire?: number;
}

// --- Abstract base ---

export abstract class Protocol {
  abstract readonly capabilities: ProtocolCapabilities;

  abstract decode(raw: unknown): DomainEvent[];

  abstract sendMessage(opts: SendMessageOptions): void;
  abstract sendPosition(opts: SendPositionOptions): void;
  abstract sendTraceRoute(nodeId: number): void;
  abstract sendWaypoint(opts: SendWaypointOptions): void;
}
