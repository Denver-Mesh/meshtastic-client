import type { Connection } from '@liamcottle/meshcore.js';
import type { MeshDevice } from '@meshtastic/core';
import { Portnums } from '@meshtastic/protobufs';

import { removeConnection, setConnection } from '../../stores/connectionStore';
import {
  addIdentity,
  getIdentity,
  removeIdentity,
  setActiveIdentity,
} from '../../stores/identityStore';
import { pubkeyToNodeId } from '../meshcoreUtils';
import { MeshCoreProtocol } from '../protocols/MeshCoreProtocol';
import { MeshtasticProtocol } from '../protocols/MeshtasticProtocol';
import type { Protocol } from '../protocols/Protocol';
import type { ConnectionType, Identity, IdentityId } from '../types';
import { packetRouter } from './PacketRouter';

export type ConnectParams =
  | { protocol: 'meshtastic'; transport: ConnectionType; device: MeshDevice }
  | { protocol: 'meshcore'; transport: ConnectionType; conn: Connection };

interface MeshCoreEventBus {
  on(event: string | number, cb: (...args: unknown[]) => void): void;
  off(event: string | number, cb: (...args: unknown[]) => void): void;
  getSelfInfo(timeout?: number): Promise<{ publicKey?: Uint8Array }>;
}

export class ConnectionDriver {
  private identityId: IdentityId | null = null;

  async connect(params: ConnectParams): Promise<() => void> {
    if (params.protocol === 'meshtastic') {
      return this.connectMeshtastic(params);
    }
    return this.connectMeshCore(params);
  }

  private connectMeshtastic(
    params: Extract<ConnectParams, { protocol: 'meshtastic' }>,
  ): Promise<() => void> {
    const { device, transport } = params;
    const protocol = new MeshtasticProtocol(device);
    const unsubs: (() => void)[] = [];

    unsubs.push(
      device.events.onMyNodeInfo.subscribe((info) => {
        this.registerIdentity({
          selfAddress: String(info.myNodeNum),
          protocol,
          activeTransports: [transport],
        });
      }),
    );

    unsubs.push(
      device.events.onMeshPacket.subscribe((packet) => {
        if (packet.payloadVariant.case !== 'decoded') return;
        const portnum = Number((packet.payloadVariant.value as { portnum?: unknown }).portnum);
        if (portnum === Number(Portnums.PortNum.TEXT_MESSAGE_APP)) {
          this.onRawPacket({ kind: 'text_message', raw: packet });
        } else if (portnum === Number(Portnums.PortNum.TRACEROUTE_APP)) {
          this.onRawPacket({ kind: 'trace_route', raw: packet });
        }
      }),
    );

    unsubs.push(
      device.events.onNodeInfoPacket.subscribe((packet) => {
        this.onRawPacket({ kind: 'node_info', raw: packet });
      }),
    );

    unsubs.push(
      device.events.onPositionPacket.subscribe((packet) => {
        this.onRawPacket({ kind: 'position', raw: packet });
      }),
    );

    unsubs.push(
      device.events.onTelemetryPacket.subscribe((packet) => {
        this.onRawPacket({ kind: 'telemetry', raw: packet });
      }),
    );

    unsubs.push(
      device.events.onWaypointPacket.subscribe((packet) => {
        this.onRawPacket({ kind: 'waypoint', raw: packet });
      }),
    );

    unsubs.push(
      device.events.onTraceRoutePacket.subscribe((packet) => {
        this.onRawPacket({ kind: 'trace_route', raw: packet });
      }),
    );

    return Promise.resolve(() => {
      unsubs.forEach((fn) => {
        fn();
      });
      this.unregisterIdentity();
    });
  }

  private async connectMeshCore(
    params: Extract<ConnectParams, { protocol: 'meshcore' }>,
  ): Promise<() => void> {
    const { conn, transport } = params;
    const bus = conn as unknown as MeshCoreEventBus;
    const info = await bus.getSelfInfo(5000);
    const nodeId = info.publicKey ? pubkeyToNodeId(info.publicKey) : 0;
    const protocol = new MeshCoreProtocol(conn);

    this.registerIdentity({
      selfAddress: String(nodeId),
      protocol,
      activeTransports: [transport],
    });

    const onAdvert = (data: unknown) => {
      this.onRawPacket({ kind: 'advert', raw: data });
    };
    const onDm = (data: unknown) => {
      this.onRawPacket({ kind: 'direct_message', raw: data });
    };
    const onChannel = (data: unknown) => {
      this.onRawPacket({ kind: 'channel_message', raw: data });
    };

    bus.on(128, onAdvert);
    bus.on(7, onDm);
    bus.on(8, onChannel);

    return () => {
      bus.off(128, onAdvert);
      bus.off(7, onDm);
      bus.off(8, onChannel);
      this.unregisterIdentity();
    };
  }

  registerIdentity(opts: {
    selfAddress: string;
    protocol: Protocol;
    activeTransports: ConnectionType[];
    displayName?: string;
    shortName?: string;
    hardwareModel?: string;
  }): IdentityId {
    const id: IdentityId = opts.selfAddress;
    const existing = getIdentity(id);
    const identity: Identity = {
      ...existing,
      id,
      selfAddress: opts.selfAddress,
      protocol: opts.protocol,
      activeTransports: opts.activeTransports,
      displayName: opts.displayName ?? existing?.displayName,
      shortName: opts.shortName ?? existing?.shortName,
      hardwareModel: opts.hardwareModel ?? existing?.hardwareModel,
      createdAt: existing?.createdAt ?? Date.now(),
      lastSeenAt: Date.now(),
    };
    addIdentity(identity);
    setActiveIdentity(id);
    setConnection(id, {
      status: 'configured',
      connectionType: opts.activeTransports[0] ?? null,
      myNodeNum: parseInt(opts.selfAddress) || 0,
    });
    this.identityId = id;
    return id;
  }

  onRawPacket(raw: unknown): void {
    const id = this.identityId;
    if (!id) return;
    const identity = getIdentity(id);
    if (!identity) return;
    packetRouter.route(raw, identity.protocol, id);
  }

  unregisterIdentity(): void {
    if (!this.identityId) return;
    removeConnection(this.identityId);
    removeIdentity(this.identityId);
    this.identityId = null;
  }

  getIdentityId(): IdentityId | null {
    return this.identityId;
  }
}
