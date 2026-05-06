import { create, toBinary } from '@bufbuild/protobuf';
import type { MeshDevice } from '@meshtastic/core';
import { Admin, Channel as ProtobufChannel, Mesh, Portnums } from '@meshtastic/protobufs';

import { meshtasticHwModelName } from '../hardwareModels';
import type { ProtocolCapabilities } from '../radio/BaseRadioProvider';
import { MESHTASTIC_CAPABILITIES } from '../radio/BaseRadioProvider';
import type {
  DomainEvent,
  SendMessageOptions,
  SendPositionOptions,
  SendWaypointOptions,
  SetChannelOptions,
  SetOwnerOptions,
} from './Protocol';
import { Protocol } from './Protocol';

export interface MeshtasticRawPacketEntry {
  ts: number;
  snr: number;
  rssi: number;
  raw: Uint8Array;
  fromNodeId: number | null;
  portLabel: string;
  viaMqtt: boolean;
  isLocal?: boolean;
}

export type MeshtasticRawEvent =
  | { kind: 'text_message'; raw: unknown }
  | { kind: 'node_info'; raw: unknown }
  | { kind: 'position'; raw: unknown }
  | { kind: 'telemetry'; raw: unknown }
  | { kind: 'waypoint'; raw: unknown }
  | { kind: 'trace_route'; raw: unknown };

export class MeshtasticProtocol extends Protocol {
  readonly capabilities: ProtocolCapabilities = MESHTASTIC_CAPABILITIES;

  constructor(private readonly device: MeshDevice) {
    super();
  }

  decode(raw: unknown): DomainEvent[] {
    const event = raw as MeshtasticRawEvent;
    switch (event.kind) {
      case 'text_message':
        return this.decodeTextMessage(event.raw);
      case 'node_info':
        return this.decodeNodeInfo(event.raw);
      case 'position':
        return this.decodePosition(event.raw);
      case 'telemetry':
        return this.decodeTelemetry(event.raw);
      case 'waypoint':
        return this.decodeWaypoint(event.raw);
      case 'trace_route':
        return this.decodeTraceRoute(event.raw);
    }
  }

  private decodeTextMessage(raw: unknown): DomainEvent[] {
    const p = raw as {
      payloadVariant: {
        case: string;
        value: { payload: Uint8Array; replyId?: number; reply_id?: number; emoji?: number };
      };
      from: number;
      to: number;
      id: number;
      channel?: number;
      rxTime?: number;
      rxSnr?: number;
      rxRssi?: number;
      hopStart?: number;
      hopLimit?: number;
    };
    if (p.payloadVariant?.case !== 'decoded') return [];
    const data = p.payloadVariant.value;
    const hopCount =
      p.hopStart != null && p.hopLimit != null && p.hopStart >= p.hopLimit
        ? p.hopStart - p.hopLimit
        : undefined;
    const rawReplyId = data.replyId ?? data.reply_id;
    return [
      {
        type: 'text_message',
        payload: {
          id: String(p.id ?? 0),
          from: p.from,
          to: p.to,
          text: new TextDecoder().decode(data.payload),
          channelIndex: p.channel ?? 0,
          timestamp: p.rxTime ? p.rxTime * 1000 : Date.now(),
          rxSnr: p.rxSnr,
          rxRssi: p.rxRssi,
          hopCount,
          replyTo: rawReplyId ? String(rawReplyId) : undefined,
          isTapback: data.emoji != null ? data.emoji !== 0 : undefined,
        },
      },
    ];
  }

  private decodeNodeInfo(raw: unknown): DomainEvent[] {
    const p = raw as {
      num?: number;
      user?: { longName?: string; shortName?: string; hwModel?: number; role?: number };
      lastHeard?: number;
    };
    if (!p.num) return [];
    return [
      {
        type: 'node_info',
        payload: {
          nodeId: p.num,
          longName: p.user?.longName,
          shortName: p.user?.shortName,
          hwModel: p.user?.hwModel != null ? meshtasticHwModelName(p.user.hwModel) : undefined,
          role: p.user?.role,
          lastHeardAt: p.lastHeard,
        },
      },
    ];
  }

  private decodePosition(raw: unknown): DomainEvent[] {
    const p = raw as {
      from: number;
      rxTime?: number;
      data: { latitudeI?: number; longitudeI?: number; altitude?: number };
    };
    return [
      {
        type: 'position',
        payload: {
          nodeId: p.from,
          latitude: (p.data?.latitudeI ?? 0) / 1e7,
          longitude: (p.data?.longitudeI ?? 0) / 1e7,
          altitude: p.data?.altitude,
          timestamp: p.rxTime ? p.rxTime * 1000 : Date.now(),
        },
      },
    ];
  }

  private decodeTelemetry(raw: unknown): DomainEvent[] {
    const p = raw as {
      from: number;
      rxTime?: number;
      data: {
        variant?: { value?: Record<string, unknown> };
        deviceMetrics?: Record<string, unknown>;
      };
    };
    const m: Record<string, unknown> = p.data?.variant?.value ?? p.data?.deviceMetrics ?? {};
    return [
      {
        type: 'telemetry',
        payload: {
          nodeId: p.from,
          timestamp: p.rxTime ? p.rxTime * 1000 : Date.now(),
          batteryLevel: m.batteryLevel as number | undefined,
          voltage: m.voltage as number | undefined,
          channelUtilization: m.channelUtilization as number | undefined,
          airUtilTx: m.airUtilTx as number | undefined,
          temperature: m.temperature as number | undefined,
          relativeHumidity: m.relativeHumidity as number | undefined,
          barometricPressure: m.barometricPressure as number | undefined,
          iaq: m.iaq as number | undefined,
        },
      },
    ];
  }

  private decodeWaypoint(raw: unknown): DomainEvent[] {
    const p = raw as {
      from: number;
      rxTime?: number;
      data: {
        id?: number;
        name?: string;
        latitudeI?: number;
        longitudeI?: number;
        description?: string;
        lockedTo?: number;
        expire?: number;
      };
    };
    if (!p.data?.id) return [];
    return [
      {
        type: 'waypoint',
        payload: {
          id: p.data.id,
          name: p.data.name ?? '',
          description: p.data.description,
          latitude: (p.data.latitudeI ?? 0) / 1e7,
          longitude: (p.data.longitudeI ?? 0) / 1e7,
          lockedTo: p.data.lockedTo,
          expire: p.data.expire,
          from: p.from,
          timestamp: p.rxTime ? p.rxTime * 1000 : Date.now(),
        },
      },
    ];
  }

  private decodeTraceRoute(raw: unknown): DomainEvent[] {
    const p = raw as {
      from: number;
      to?: number;
      rxTime?: number;
      data: { route?: readonly number[]; routeBack?: readonly number[] };
    };
    return [
      {
        type: 'trace_route',
        payload: {
          from: p.from,
          to: p.to ?? 0,
          route: Array.from(p.data?.route ?? []),
          routeBack: p.data?.routeBack ? Array.from(p.data.routeBack) : undefined,
          timestamp: p.rxTime ? p.rxTime * 1000 : Date.now(),
        },
      },
    ];
  }

  sendMessage(opts: SendMessageOptions): void {
    const dest: number | 'broadcast' = opts.destination ?? 'broadcast';
    void this.device.sendText(opts.text, dest, true, opts.channelIndex ?? 0);
  }

  sendPosition(opts: SendPositionOptions): void {
    void this.device.setPosition(
      create(Mesh.PositionSchema, {
        latitudeI: Math.round(opts.latitude * 1e7),
        longitudeI: Math.round(opts.longitude * 1e7),
        altitude: opts.altitude ?? 0,
        time: Math.floor(Date.now() / 1000),
      }) as Parameters<MeshDevice['setPosition']>[0],
    );
  }

  sendTraceRoute(nodeId: number): void {
    void this.device.traceRoute(nodeId);
  }

  sendWaypoint(opts: SendWaypointOptions): void {
    void this.device.sendWaypoint(
      create(Mesh.WaypointSchema, {
        id: opts.id,
        name: opts.name,
        description: opts.description ?? '',
        latitudeI: Math.round(opts.latitude * 1e7),
        longitudeI: Math.round(opts.longitude * 1e7),
        lockedTo: opts.lockedTo ?? 0,
        expire: opts.expire ?? 0,
      }) as Parameters<MeshDevice['sendWaypoint']>[0],
      0xffffffff,
      0,
    );
  }

  // --- Device lifecycle ---

  async reboot(delay = 2): Promise<void> {
    await this.device.reboot(delay);
  }

  async shutdown(delay = 2): Promise<void> {
    await this.device.shutdown(delay);
  }

  async factoryReset(): Promise<void> {
    await this.device.factoryResetDevice();
  }

  async resetNodeDb(): Promise<void> {
    await this.device.resetNodes();
  }

  async rebootOta(delay = 2): Promise<void> {
    await this.device.rebootOta(delay);
  }

  async enterDfuMode(): Promise<void> {
    await this.device.enterDfuMode();
  }

  async factoryResetConfig(): Promise<void> {
    await this.device.factoryResetConfig();
  }

  async requestRefresh(): Promise<void> {
    await this.device.configure();
  }

  // --- Config ---

  async setConfig(config: unknown): Promise<void> {
    await this.device.setConfig(config as any);
  }

  async commitConfig(): Promise<void> {
    await this.device.commitEditSettings();
  }

  async setChannel(opts: SetChannelOptions): Promise<void> {
    const channel = create(ProtobufChannel.ChannelSchema, {
      index: opts.index,
      role: opts.role,
      settings: create(ProtobufChannel.ChannelSettingsSchema, {
        name: opts.settings.name,
        psk: opts.settings.psk,
        uplinkEnabled: opts.settings.uplinkEnabled,
        downlinkEnabled: opts.settings.downlinkEnabled,
        moduleSettings: create(ProtobufChannel.ModuleSettingsSchema, {
          positionPrecision: opts.settings.positionPrecision,
        }),
      }),
    }) as Parameters<MeshDevice['setChannel']>[0];
    await this.device.setChannel(channel);
  }

  async clearChannel(index: number): Promise<void> {
    await this.device.clearChannel(index);
  }

  async setOwner(opts: SetOwnerOptions): Promise<void> {
    const user = create(Mesh.UserSchema, {
      longName: opts.longName,
      shortName: opts.shortName,
      isLicensed: opts.isLicensed,
    }) as Parameters<MeshDevice['setOwner']>[0];
    await this.device.setOwner(user);
  }

  async setModuleConfig(config: unknown): Promise<void> {
    await (this.device as any).setModuleConfig(config);
  }

  async setCannedMessages(messages: string[]): Promise<void> {
    await (this.device as any).setCannedMessages({ messages: messages.join('\n') });
  }

  async setRingtone(ringtone: string): Promise<void> {
    const msg = create(Admin.AdminMessageSchema, {
      payloadVariant: { case: 'setRingtoneMessage', value: ringtone },
    });

    await (this.device as any).sendPacket(
      toBinary(Admin.AdminMessageSchema, msg),
      Portnums.PortNum.ADMIN_APP,
      'self',
    );
  }

  // --- GPS / position ---

  async sendPositionToDevice(lat: number, lon: number, alt?: number): Promise<void> {
    await this.device.setPosition(
      create(Mesh.PositionSchema, {
        latitudeI: Math.round(lat * 1e7),
        longitudeI: Math.round(lon * 1e7),
        altitude: alt ?? 0,
        time: Math.floor(Date.now() / 1000),
      }) as Parameters<MeshDevice['setPosition']>[0],
    );
  }

  async requestPosition(nodeId: number): Promise<void> {
    await this.device.requestPosition(nodeId);
  }
}
