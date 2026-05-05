import { addMessage } from '../../stores/messageStore';
import {
  addTraceRoute,
  updatePosition,
  updateTelemetry,
  upsertNode,
  upsertWaypoint,
} from '../../stores/nodeStore';
import type { DomainEvent, Protocol } from '../protocols/Protocol';
import type { IdentityId } from '../types';

class PacketRouter {
  route(raw: unknown, protocol: Protocol, identityId: IdentityId): void {
    let events: DomainEvent[];
    try {
      events = protocol.decode(raw);
    } catch (err) {
      console.warn('[PacketRouter] decode failed', err);
      return;
    }
    for (const event of events) {
      this.dispatch(event, identityId);
    }
  }

  private dispatch(event: DomainEvent, identityId: IdentityId): void {
    switch (event.type) {
      case 'text_message':
        addMessage(identityId, event.payload);
        break;
      case 'node_info':
        upsertNode(identityId, event.payload);
        break;
      case 'position':
        updatePosition(identityId, event.payload);
        break;
      case 'telemetry':
        updateTelemetry(identityId, event.payload);
        break;
      case 'trace_route':
        addTraceRoute(identityId, event.payload);
        break;
      case 'waypoint':
        upsertWaypoint(identityId, event.payload);
        break;
    }
  }
}

export const packetRouter = new PacketRouter();
