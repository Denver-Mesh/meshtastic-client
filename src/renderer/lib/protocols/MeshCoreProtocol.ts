import type { Connection } from '@liamcottle/meshcore.js';

import { pubkeyToNodeId } from '../meshcoreUtils';
import type { ProtocolCapabilities } from '../radio/BaseRadioProvider';
import { MESHCORE_CAPABILITIES } from '../radio/BaseRadioProvider';
import type {
  DomainEvent,
  SendMessageOptions,
  SendPositionOptions,
  SendWaypointOptions,
} from './Protocol';
import { Protocol } from './Protocol';

const MESHCORE_COORD_SCALE = 1e6;

export type MeshCoreRawEvent =
  | { kind: 'advert'; raw: unknown }
  | { kind: 'direct_message'; raw: unknown }
  | { kind: 'channel_message'; raw: unknown };

export class MeshCoreProtocol extends Protocol {
  readonly capabilities: ProtocolCapabilities = MESHCORE_CAPABILITIES;

  private readonly pubKeyMap = new Map<number, Uint8Array>();
  private readonly pubKeyPrefixMap = new Map<string, number>();

  constructor(private readonly conn: Connection) {
    super();
  }

  decode(raw: unknown): DomainEvent[] {
    const event = raw as MeshCoreRawEvent;
    switch (event.kind) {
      case 'advert':
        return this.decodeAdvert(event.raw);
      case 'direct_message':
        return this.decodeDirectMessage(event.raw);
      case 'channel_message':
        return this.decodeChannelMessage(event.raw);
    }
  }

  private decodeAdvert(raw: unknown): DomainEvent[] {
    const d = raw as {
      publicKey: Uint8Array;
      advLat?: number;
      advLon?: number;
      lastAdvert?: number;
      advName?: string;
    };
    if (d.publicKey?.length !== 32) return [];
    const nodeId = pubkeyToNodeId(d.publicKey);
    if (nodeId === 0) return [];

    this.pubKeyMap.set(nodeId, d.publicKey);
    const prefix = Array.from(d.publicKey.slice(0, 6))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    this.pubKeyPrefixMap.set(prefix, nodeId);

    const events: DomainEvent[] = [
      {
        type: 'node_info',
        payload: { nodeId, longName: d.advName, lastHeardAt: d.lastAdvert },
      },
    ];

    const hasLat = typeof d.advLat === 'number' && d.advLat !== 0;
    const hasLon = typeof d.advLon === 'number' && d.advLon !== 0;
    if (hasLat && hasLon) {
      events.push({
        type: 'position',
        payload: {
          nodeId,
          latitude: d.advLat! / MESHCORE_COORD_SCALE,
          longitude: d.advLon! / MESHCORE_COORD_SCALE,
          timestamp: d.lastAdvert ?? Date.now(),
        },
      });
    }
    return events;
  }

  private decodeDirectMessage(raw: unknown): DomainEvent[] {
    const d = raw as {
      pubKeyPrefix: Uint8Array;
      text: string;
      senderTimestamp: number;
      txtType?: number;
    };
    if (d.txtType === 1) return [];
    const prefix = Array.from(d.pubKeyPrefix)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const senderId = this.pubKeyPrefixMap.get(prefix) ?? 0;
    return [
      {
        type: 'text_message',
        payload: {
          id: `${senderId}:${d.senderTimestamp}`,
          from: senderId,
          to: 0,
          text: d.text,
          channelIndex: 0,
          timestamp: d.senderTimestamp * 1000,
        },
      },
    ];
  }

  private decodeChannelMessage(raw: unknown): DomainEvent[] {
    const d = raw as { channelIdx: number; text: string; senderTimestamp: number };
    return [
      {
        type: 'text_message',
        payload: {
          id: `ch:${d.channelIdx}:${d.senderTimestamp}`,
          from: 0,
          to: 0,
          text: d.text,
          channelIndex: d.channelIdx,
          timestamp: d.senderTimestamp * 1000,
        },
      },
    ];
  }

  sendMessage(opts: SendMessageOptions): void {
    if (opts.destination != null) {
      const pubKey = this.pubKeyMap.get(opts.destination);
      if (!pubKey) {
        console.warn('[MeshCoreProtocol] no public key for node', opts.destination);
        return;
      }
      void this.conn.sendTextMessage(pubKey, opts.text);
    } else {
      void this.conn.sendChannelTextMessage(opts.channelIndex ?? 0, opts.text);
    }
  }

  sendPosition(_opts: SendPositionOptions): void {
    // MeshCore does not support sending position over the Protocol layer
  }

  sendTraceRoute(_nodeId: number): void {
    // MeshCore trace route is initiated via conn.requestPath — wired in the connection driver
  }

  sendWaypoint(_opts: SendWaypointOptions): void {
    // MeshCore does not support waypoints
  }
}
