import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeshtasticRawEvent } from './MeshtasticProtocol';
import { MeshtasticProtocol } from './MeshtasticProtocol';

const mockDevice = {
  sendText: vi.fn(),
  setPosition: vi.fn(),
  traceRoute: vi.fn(),
  sendWaypoint: vi.fn(),
};

function makeProtocol() {
  return new MeshtasticProtocol(mockDevice as never);
}

function textPacket(opts: {
  payload: string;
  from: number;
  to: number;
  id: number;
  channel?: number;
  rxTime?: number;
  rxSnr?: number;
  rxRssi?: number;
  hopStart?: number;
  hopLimit?: number;
}): MeshtasticRawEvent {
  return {
    kind: 'text_message',
    raw: {
      payloadVariant: {
        case: 'decoded',
        value: { payload: new TextEncoder().encode(opts.payload) },
      },
      from: opts.from,
      to: opts.to,
      id: opts.id,
      channel: opts.channel ?? 0,
      rxTime: opts.rxTime,
      rxSnr: opts.rxSnr,
      rxRssi: opts.rxRssi,
      hopStart: opts.hopStart,
      hopLimit: opts.hopLimit,
    },
  };
}

describe('MeshtasticProtocol', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('decode', () => {
    describe('text_message', () => {
      it('maps packet id to string id', () => {
        const [event] = makeProtocol().decode(
          textPacket({ payload: 'hello', from: 111, to: 222, id: 42, rxTime: 1 }),
        );
        expect(event.type).toBe('text_message');
        if (event.type === 'text_message') {
          expect(event.payload.id).toBe('42');
        }
      });

      it('passes through optional signal fields', () => {
        const [event] = makeProtocol().decode(
          textPacket({
            payload: 'hi',
            from: 111,
            to: 222,
            id: 1,
            rxTime: 1,
            rxSnr: 4.5,
            rxRssi: -90,
            hopStart: 5,
            hopLimit: 3,
          }),
        );
        if (event.type === 'text_message') {
          expect(event.payload.rxSnr).toBe(4.5);
          expect(event.payload.rxRssi).toBe(-90);
          expect(event.payload.hopCount).toBe(2);
        }
      });

      it('returns empty array when payloadVariant is not decoded', () => {
        const raw: MeshtasticRawEvent = {
          kind: 'text_message',
          raw: { payloadVariant: { case: 'encrypted', value: {} }, from: 1, to: 2, id: 1 },
        };
        expect(makeProtocol().decode(raw)).toHaveLength(0);
      });
    });

    describe('node_info', () => {
      it('uses num as nodeId', () => {
        const raw: MeshtasticRawEvent = {
          kind: 'node_info',
          raw: { num: 333, user: { longName: 'Test Node', shortName: 'TN' } },
        };
        const [event] = makeProtocol().decode(raw);
        expect(event.type).toBe('node_info');
        if (event.type === 'node_info') {
          expect(event.payload.nodeId).toBe(333);
          expect(event.payload.longName).toBe('Test Node');
        }
      });

      it('returns empty array when num is missing', () => {
        const raw: MeshtasticRawEvent = { kind: 'node_info', raw: { user: { longName: 'X' } } };
        expect(makeProtocol().decode(raw)).toHaveLength(0);
      });
    });

    describe('position', () => {
      it('converts integer coords to decimal degrees', () => {
        const raw: MeshtasticRawEvent = {
          kind: 'position',
          raw: {
            from: 444,
            data: { latitudeI: 399000000, longitudeI: -1050000000, altitude: 1600 },
            rxTime: 2,
          },
        };
        const [event] = makeProtocol().decode(raw);
        expect(event.type).toBe('position');
        if (event.type === 'position') {
          expect(event.payload.latitude).toBeCloseTo(39.9);
          expect(event.payload.longitude).toBeCloseTo(-105.0);
          expect(event.payload.altitude).toBe(1600);
        }
      });
    });

    describe('telemetry', () => {
      it('maps all device metric fields', () => {
        const raw: MeshtasticRawEvent = {
          kind: 'telemetry',
          raw: {
            from: 555,
            data: {
              variant: {
                value: { batteryLevel: 85, voltage: 3.9, channelUtilization: 12.5 },
              },
            },
            rxTime: 3,
          },
        };
        const [event] = makeProtocol().decode(raw);
        expect(event.type).toBe('telemetry');
        if (event.type === 'telemetry') {
          expect(event.payload.nodeId).toBe(555);
          expect(event.payload.batteryLevel).toBe(85);
          expect(event.payload.channelUtilization).toBe(12.5);
        }
      });
    });

    describe('waypoint', () => {
      it('converts integer coords to decimal degrees', () => {
        const raw: MeshtasticRawEvent = {
          kind: 'waypoint',
          raw: {
            from: 666,
            data: { id: 1, name: 'Camp', latitudeI: 400000000, longitudeI: -1060000000 },
            rxTime: 4,
          },
        };
        const [event] = makeProtocol().decode(raw);
        expect(event.type).toBe('waypoint');
        if (event.type === 'waypoint') {
          expect(event.payload.name).toBe('Camp');
          expect(event.payload.latitude).toBeCloseTo(40.0);
          expect(event.payload.longitude).toBeCloseTo(-106.0);
        }
      });

      it('returns empty array when waypoint id is missing', () => {
        const raw: MeshtasticRawEvent = {
          kind: 'waypoint',
          raw: { from: 1, data: { name: 'No ID' }, rxTime: 1 },
        };
        expect(makeProtocol().decode(raw)).toHaveLength(0);
      });
    });

    describe('trace_route', () => {
      it('preserves route and routeBack arrays', () => {
        const raw: MeshtasticRawEvent = {
          kind: 'trace_route',
          raw: {
            from: 111,
            to: 999,
            data: { route: [111, 222, 999], routeBack: [999, 222, 111] },
            rxTime: 5,
          },
        };
        const [event] = makeProtocol().decode(raw);
        expect(event.type).toBe('trace_route');
        if (event.type === 'trace_route') {
          expect(event.payload.route).toEqual([111, 222, 999]);
          expect(event.payload.routeBack).toEqual([999, 222, 111]);
        }
      });
    });
  });

  describe('sendMessage', () => {
    it('delegates to device.sendText with destination and channel', () => {
      makeProtocol().sendMessage({ text: 'hi', destination: 222, channelIndex: 1 });
      expect(mockDevice.sendText).toHaveBeenCalledWith('hi', 222, true, 1);
    });

    it('defaults to broadcast when no destination given', () => {
      makeProtocol().sendMessage({ text: 'broadcast' });
      expect(mockDevice.sendText).toHaveBeenCalledWith('broadcast', 'broadcast', true, 0);
    });
  });

  describe('sendTraceRoute', () => {
    it('delegates to device.traceRoute', () => {
      makeProtocol().sendTraceRoute(777);
      expect(mockDevice.traceRoute).toHaveBeenCalledWith(777);
    });
  });
});
