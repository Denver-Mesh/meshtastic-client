import { create } from 'zustand';

import type { OurPosition } from '../lib/gpsSource';
import type { RawPacketEntry } from '../lib/protocols/Protocol';
import type { IdentityId } from '../lib/types';

export interface ChannelConfig {
  index: number;
  name: string;
  role: number;
  psk: Uint8Array;
  uplinkEnabled: boolean;
  downlinkEnabled: boolean;
  positionPrecision: number;
}

export interface SecurityConfig {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  adminKey: Uint8Array[];
  isManaged: boolean;
  serialEnabled: boolean;
  debugLogApiEnabled: boolean;
  adminChannelEnabled: boolean;
}

export interface DeviceOwner {
  id: string;
  longName: string;
  shortName: string;
}

export interface DeviceLogEntry {
  message: string;
  time: number;
  source: string;
  level: number;
}

export interface DeviceRecord {
  channels: { index: number; name: string }[];
  channelConfigs: ChannelConfig[];
  moduleConfigs: Record<string, unknown>;
  securityConfig: SecurityConfig | null;
  deviceOwner: DeviceOwner | null;
  deviceGpsMode: number;
  deviceFixedPosition: boolean | null;
  telemetryDeviceUpdateInterval: number | null;
  ourPosition: OurPosition | null;
  rawPackets: RawPacketEntry[];
  deviceLogs: DeviceLogEntry[];
  ringtone: string | null;
}

const defaultRecord: DeviceRecord = {
  channels: [],
  channelConfigs: [],
  moduleConfigs: {},
  securityConfig: null,
  deviceOwner: null,
  deviceGpsMode: 0,
  deviceFixedPosition: null,
  telemetryDeviceUpdateInterval: null,
  ourPosition: null,
  rawPackets: [],
  deviceLogs: [],
  ringtone: null,
};

interface DeviceStoreState {
  devices: Record<IdentityId, DeviceRecord>;
}

const defaultState: DeviceStoreState = {
  devices: {},
};

export const useDeviceStore = create<DeviceStoreState>()(() => defaultState);

function patch(id: IdentityId, updates: Partial<DeviceRecord>): void {
  useDeviceStore.setState((s) => ({
    devices: {
      ...s.devices,
      [id]: { ...(s.devices[id] ?? defaultRecord), ...updates },
    },
  }));
}

export function setDeviceChannels(
  id: IdentityId,
  channels: DeviceRecord['channels'],
  channelConfigs: ChannelConfig[],
): void {
  patch(id, { channels, channelConfigs });
}

export function setModuleConfigs(id: IdentityId, moduleConfigs: Record<string, unknown>): void {
  patch(id, { moduleConfigs });
}

export function setSecurityConfig(id: IdentityId, securityConfig: SecurityConfig): void {
  patch(id, { securityConfig });
}

export function setDeviceOwner(id: IdentityId, deviceOwner: DeviceOwner): void {
  patch(id, { deviceOwner });
}

export function setDeviceGpsState(
  id: IdentityId,
  deviceGpsMode: number,
  deviceFixedPosition: boolean | null,
): void {
  patch(id, { deviceGpsMode, deviceFixedPosition });
}

export function setTelemetryDeviceUpdateInterval(id: IdentityId, interval: number | null): void {
  patch(id, { telemetryDeviceUpdateInterval: interval });
}

export function setOurPosition(id: IdentityId, ourPosition: OurPosition | null): void {
  patch(id, { ourPosition });
}

export function appendRawPacket(id: IdentityId, entry: RawPacketEntry): void {
  const MAX = 2500;
  useDeviceStore.setState((s) => {
    const prev = (s.devices[id] ?? defaultRecord).rawPackets;
    const next = prev.length >= MAX ? prev.slice(-(MAX - 1)) : prev;
    return {
      devices: {
        ...s.devices,
        [id]: { ...(s.devices[id] ?? defaultRecord), rawPackets: [...next, entry] },
      },
    };
  });
}

export function clearRawPackets(id: IdentityId): void {
  patch(id, { rawPackets: [] });
}

export function appendDeviceLog(id: IdentityId, entry: DeviceLogEntry): void {
  const MAX = 500;
  useDeviceStore.setState((s) => {
    const prev = (s.devices[id] ?? defaultRecord).deviceLogs;
    const next = prev.length >= MAX ? prev.slice(-(MAX - 1)) : prev;
    return {
      devices: {
        ...s.devices,
        [id]: { ...(s.devices[id] ?? defaultRecord), deviceLogs: [...next, entry] },
      },
    };
  });
}

export function setRingtone(id: IdentityId, ringtone: string | null): void {
  patch(id, { ringtone });
}

export function clearDeviceIdentity(id: IdentityId): void {
  useDeviceStore.setState((s) => {
    const { [id]: _removed, ...rest } = s.devices;
    return { devices: rest };
  });
}

export function getDevice(id: IdentityId): DeviceRecord {
  return useDeviceStore.getState().devices[id] ?? defaultRecord;
}
