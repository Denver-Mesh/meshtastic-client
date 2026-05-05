import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeshCoreRawEvent } from './MeshCoreProtocol';
import { MeshCoreProtocol } from './MeshCoreProtocol';

const mockConn = {
  sendTextMessage: vi.fn(),
  sendChannelTextMessage: vi.fn(),
};

// Build a 32-byte pubkey that XOR-folds to the given nodeId (first 4 bytes = LE uint32, rest zero).
function makeKey(nodeId: number): Uint8Array {
  const k = new Uint8Array(32);
  k[0] = nodeId & 0xff;
  k[1] = (nodeId >> 8) & 0xff;
  k[2] = (nodeId >> 16) & 0xff;
  k[3] = (nodeId >>> 24) & 0xff;
  return k;
}

function makeProtocol() {
  return new MeshCoreProtocol(mockConn as never);
}

describe('MeshCoreProtocol', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('decode', () => {
    describe('advert', () => {
      it('emits only node_info when no position in advert', () => {
        const raw: MeshCoreRawEvent = {
          kind: 'advert',
          raw: { publicKey: makeKey(111), advName: 'Alice', lastAdvert: 1000 },
        };
        const events = makeProtocol().decode(raw);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('node_info');
        if (events[0].type === 'node_info') {
          expect(events[0].payload.nodeId).toBe(111);
          expect(events[0].payload.longName).toBe('Alice');
        }
      });

      it('emits node_info + position when advert carries coordinates', () => {
        const raw: MeshCoreRawEvent = {
          kind: 'advert',
          raw: {
            publicKey: makeKey(222),
            advLat: 39900000,
            advLon: -105000000,
            advName: 'Bob',
            lastAdvert: 2000,
          },
        };
        const events = makeProtocol().decode(raw);
        expect(events).toHaveLength(2);
        expect(events[0].type).toBe('node_info');
        expect(events[1].type).toBe('position');
        if (events[1].type === 'position') {
          expect(events[1].payload.latitude).toBeCloseTo(39.9);
          expect(events[1].payload.longitude).toBeCloseTo(-105.0);
        }
      });

      it('returns empty array for invalid pubkey', () => {
        const raw: MeshCoreRawEvent = {
          kind: 'advert',
          raw: { publicKey: new Uint8Array(5), advName: 'Bad' },
        };
        expect(makeProtocol().decode(raw)).toHaveLength(0);
      });
    });

    describe('direct_message', () => {
      it('resolves sender from pubkey prefix and builds id', () => {
        const protocol = makeProtocol();
        const pubKey = makeKey(333);
        protocol.decode({ kind: 'advert', raw: { publicKey: pubKey, advName: 'Sender' } });
        const [event] = protocol.decode({
          kind: 'direct_message',
          raw: { pubKeyPrefix: pubKey.slice(0, 6), text: 'hey', senderTimestamp: 3000 },
        });
        expect(event.type).toBe('text_message');
        if (event.type === 'text_message') {
          expect(event.payload.from).toBe(333);
          expect(event.payload.channelIndex).toBe(0);
          expect(event.payload.id).toBe('333:3000');
        }
      });

      it('skips CLI responses (txtType === 1)', () => {
        const protocol = makeProtocol();
        const pubKey = makeKey(333);
        protocol.decode({ kind: 'advert', raw: { publicKey: pubKey, advName: 'Sender' } });
        const events = protocol.decode({
          kind: 'direct_message',
          raw: {
            pubKeyPrefix: pubKey.slice(0, 6),
            text: 'status ok',
            senderTimestamp: 1,
            txtType: 1,
          },
        });
        expect(events).toHaveLength(0);
      });
    });

    describe('channel_message', () => {
      it('includes channelIdx in id and payload', () => {
        const [event] = makeProtocol().decode({
          kind: 'channel_message',
          raw: { channelIdx: 2, text: 'broadcast', senderTimestamp: 4000 },
        });
        expect(event.type).toBe('text_message');
        if (event.type === 'text_message') {
          expect(event.payload.channelIndex).toBe(2);
          expect(event.payload.id).toBe('ch:2:4000');
        }
      });
    });
  });

  describe('sendMessage', () => {
    describe('direct', () => {
      it('sends via conn.sendTextMessage after pubkey learned from advert', () => {
        const protocol = makeProtocol();
        const pubKey = makeKey(999);
        protocol.decode({ kind: 'advert', raw: { publicKey: pubKey, advName: 'Peer' } });
        protocol.sendMessage({ text: 'hi', destination: 999 });
        expect(mockConn.sendTextMessage).toHaveBeenCalledWith(pubKey, 'hi');
      });

      it('warns and no-ops when pubkey not available', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        makeProtocol().sendMessage({ text: 'hi', destination: 42 });
        expect(mockConn.sendTextMessage).not.toHaveBeenCalled();
        warn.mockRestore();
      });
    });

    describe('channel', () => {
      it('sends via conn.sendChannelTextMessage with channelIndex', () => {
        makeProtocol().sendMessage({ text: 'broadcast', channelIndex: 1 });
        expect(mockConn.sendChannelTextMessage).toHaveBeenCalledWith(1, 'broadcast');
      });

      it('defaults to channel 0 when channelIndex omitted', () => {
        makeProtocol().sendMessage({ text: 'broadcast' });
        expect(mockConn.sendChannelTextMessage).toHaveBeenCalledWith(0, 'broadcast');
      });
    });
  });
});
