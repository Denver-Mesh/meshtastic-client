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

// --- Raw packet log ---

export interface RawPacketEntry {
  ts: number;
  snr: number;
  rssi: number;
  raw: Uint8Array;
  fromNodeId: number | null;
}

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

// --- Management options ---

export interface SetOwnerOptions {
  longName: string;
  shortName: string;
  isLicensed: boolean;
}

export interface SetChannelOptions {
  index: number;
  role: number;
  settings: {
    name: string;
    psk: Uint8Array;
    uplinkEnabled: boolean;
    downlinkEnabled: boolean;
    positionPrecision: number;
  };
}

// --- Abstract base ---

export abstract class Protocol {
  abstract readonly capabilities: ProtocolCapabilities;

  abstract decode(raw: unknown): DomainEvent[];

  // --- Send ---
  abstract sendMessage(opts: SendMessageOptions): void;
  abstract sendPosition(opts: SendPositionOptions): void;
  abstract sendTraceRoute(nodeId: number): void;
  abstract sendWaypoint(opts: SendWaypointOptions): void;

  // --- Device lifecycle (no-op defaults; override in protocol implementations) ---
  reboot(_delay?: number): Promise<void> {
    return Promise.resolve();
  }
  shutdown(_delay?: number): Promise<void> {
    return Promise.resolve();
  }
  factoryReset(): Promise<void> {
    return Promise.resolve();
  }
  resetNodeDb(): Promise<void> {
    return Promise.resolve();
  }
  rebootOta(_delay?: number): Promise<void> {
    return Promise.resolve();
  }
  enterDfuMode(): Promise<void> {
    return Promise.resolve();
  }
  factoryResetConfig(): Promise<void> {
    return Promise.resolve();
  }
  requestRefresh(): Promise<void> {
    return Promise.resolve();
  }

  // --- Config (no-op defaults) ---
  setConfig(_config: unknown): Promise<void> {
    return Promise.resolve();
  }
  commitConfig(): Promise<void> {
    return Promise.resolve();
  }
  setChannel(_opts: SetChannelOptions): Promise<void> {
    return Promise.resolve();
  }
  clearChannel(_index: number): Promise<void> {
    return Promise.resolve();
  }
  setOwner(_opts: SetOwnerOptions): Promise<void> {
    return Promise.resolve();
  }
  setModuleConfig(_config: unknown): Promise<void> {
    return Promise.resolve();
  }
  setCannedMessages(_messages: string[]): Promise<void> {
    return Promise.resolve();
  }
  setRingtone(_ringtone: string): Promise<void> {
    return Promise.resolve();
  }

  // --- GPS / position (no-op defaults) ---
  sendPositionToDevice(_lat: number, _lon: number, _alt?: number): Promise<void> {
    return Promise.resolve();
  }
  requestPosition(_nodeId: number): Promise<void> {
    return Promise.resolve();
  }
}
