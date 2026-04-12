import { describe, expect, it } from 'vitest';

import {
  meshCorePacketFingerprintHex,
  meshCoreTransportCodeForRegion,
  parseMeshCoreRfPacket,
} from './meshcoreRfPacketParse';

/** Real RF flood advert (path-prefix decode; in-house parse must succeed). */
const FLOOD_ADVERT_HEX =
  '110649cc80710706ce47b76233ce222c37bdb3bb394a75d08dfdd2d0b30d74ff5003409f10acb5a7c420dc69b3ec2d02fec6c29583702b2c8a482a64c6c8f1d0b16ba19a5ac36261512feda7c10ac08a2248146d9193ab55887227dfae25b2e9f1bfee29726efd2537aefa0692c8046302d2d9b9f944454e2d424c44522d5754562d52452d43453437';

function hexToU8(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe('parseMeshCoreRfPacket', () => {
  it('parses FLOOD ADVERT sample with hops, fingerprint, and inner ADVERT fields', () => {
    const raw = hexToU8(FLOOD_ADVERT_HEX);
    const p = parseMeshCoreRfPacket(raw);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.routeTypeString).toBe('FLOOD');
    expect(p.payloadTypeString).toBe('ADVERT');
    expect(p.hopCount).toBe(6);
    expect(p.transportCodes).toBeNull();
    expect(p.messageFingerprintHex).toBe(meshCorePacketFingerprintHex(raw));
    expect(p.advert).not.toBeNull();
    expect(p.advert!.publicKey.length).toBe(32);
    expect(p.advert!.name.length).toBeGreaterThan(0);
  });

  it('reads transport codes on TRANSPORT_FLOOD + TRACE layout', () => {
    const buffer = new Uint8Array([0x24, 0x34, 0x12, 0x78, 0x56, 0x02, 0x11, 0x22]);
    const p = parseMeshCoreRfPacket(buffer);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.transportCodes).toEqual([0x1234, 0x5678]);
    expect(p.hopCount).toBe(2);
  });
});

describe('meshCoreTransportCodeForRegion', () => {
  it('returns stable uint16 for region + payload', async () => {
    const inner = hexToU8('00'.repeat(16));
    const a = await meshCoreTransportCodeForRegion('#TestRegion', 4, inner);
    const b = await meshCoreTransportCodeForRegion('#TestRegion', 4, inner);
    expect(a).toBe(b);
    expect(a & 0xffff).toBe(a);
  });
});
