# Plan: Fix Missing Hop Count for Nodes Seen Only via Text Messages

## Context

Nodes that transmit text messages but never broadcast a NodeInfo packet show up in the app
as `!49b64160`-style stubs with no name and no hop count. Other mesh clients can show hop
counts for the same nodes because the Meshtastic firmware encodes `hopStart` and `hopLimit`
in every raw LoRa packet — the hop count can be derived as `hopStart - hopLimit` without
waiting for a NodeInfo packet.

The app currently only sets `hops_away` inside the `onNodeInfoPacket` subscriber
(`useDevice.ts:1025`). The `onMeshPacket` SNR/RSSI subscriber (`useDevice.ts:1442`) already
processes every packet for signal data, but the packet cast is too narrow to access hop
fields. This is the root cause.

---

## Bug 1 (primary): Hop count not extracted from raw MeshPackets

### File: `src/renderer/hooks/useDevice.ts`

The `onMeshPacket` subscriber at **line 1444** casts the packet to only 4 fields:

```typescript
const mp = packet as {
  id?: number;
  rxSnr?: number;
  rxRssi?: number;
  from?: number;
};
```

The Meshtastic SDK's `MeshPacket` protobuf also exposes `hopLimit: number`,
`hopStart: number`, and `viaMqtt?: boolean`, but they are never read.

### Changes needed

**Step 1 — Widen the cast** at line 1444 to include:

```typescript
const mp = packet as {
  id?: number;
  rxSnr?: number;
  rxRssi?: number;
  from?: number;
  hopLimit?: number; // ← add
  hopStart?: number; // ← add
  viaMqtt?: boolean; // ← add
};
```

**Step 2 — Derive `computedHopsAway`** immediately after the `if (!mp.from) return;` check
(line 1450), before the diagnostics block:

```typescript
const hopStart = mp.hopStart ?? 0;
const hopLimit = mp.hopLimit ?? 0;
const packetViaMqtt = mp.viaMqtt === true;
// hopStart > 0 and hopLimit <= hopStart is the structural validity invariant
// (same guard used in foreignLoraDetection.ts:20)
const computedHopsAway =
  !packetViaMqtt && hopStart > 0 && hopLimit <= hopStart ? hopStart - hopLimit : undefined;
```

**Step 3 — Widen the condition** that gates the `updateNodes` call (currently line 1464):

```typescript
// was: if (mp.rxSnr || mp.rxRssi) {
const hasSignal = Boolean(mp.rxSnr || mp.rxRssi);
const hasHopUpdate = computedHopsAway !== undefined &&
  mp.from !== myNodeNumRef.current;  // self-node hop is always 0, already handled

if (hasSignal || hasHopUpdate) {
```

**Step 4 — Apply hop count inside the `updateNodes` callback** (lines 1469–1476):

```typescript
const node: MeshNode = {
  ...existing,
  ...(mp.rxSnr ? { snr: mp.rxSnr } : {}),
  ...(mp.rxRssi ? { rssi: mp.rxRssi } : {}),
  // NEW: only update hop count when the node isn't stale
  ...(hasHopUpdate &&
  !(
    existing.last_heard > 0 &&
    Date.now() - existing.last_heard > MESHTASTIC_CAPABILITIES.nodeStaleThresholdMs
  )
    ? { hops_away: computedHopsAway }
    : {}),
};
```

The stale-node guard mirrors the existing logic in `onNodeInfoPacket` (lines 1082–1110)
so hop counts aren't applied to ghost nodes.

---

## Bug 2 (secondary, type-safety): `saveNode` API type is too narrow

### File: `src/shared/electron-api.types.ts`

`saveNode`'s declared parameter (lines 104–115) only accepts 10 fields. At runtime, full
`MeshNode` objects are passed and the IPC handler correctly persists all fields via spread
(`...node` at `index.ts:2374`), so there is **no functional data loss** — but TypeScript
allows callers to pass a node without `hops_away` being visible in the contract.

### Change needed

Replace the narrow inline type with one that includes all optional extended fields:

```typescript
saveNode: (node: {
  node_id: number;
  long_name: string | null;
  short_name: string | null;
  hw_model: string | null;
  snr: number | null;
  battery: number | null;
  last_heard: number | null;
  latitude: number | null;
  longitude: number | null;
  rssi?: number | null;
  role?: number | string | null;
  hops_away?: number | null;
  via_mqtt?: boolean | number | null;
  voltage?: number | null;
  channel_utilization?: number | null;
  air_util_tx?: number | null;
  altitude?: number | null;
  source?: string | null;
  num_packets_rx_bad?: number | null;
  num_rx_dupe?: number | null;
  num_packets_rx?: number | null;
  num_packets_tx?: number | null;
  heard_via_mqtt_only?: boolean;
  [key: string]: unknown;
}) => Promise<unknown>;
```

The `[key: string]: unknown` index signature ensures unknown `MeshNode` session-only fields
(like `lastPositionWarning`) don't cause TypeScript errors at call sites.

---

## Files to modify

| File                               | Lines      | Change                                                       |
| ---------------------------------- | ---------- | ------------------------------------------------------------ | --- | ---------------------------------------- |
| `src/renderer/hooks/useDevice.ts`  | 1444–1449  | Widen `mp` cast to include `hopLimit`, `hopStart`, `viaMqtt` |
| `src/renderer/hooks/useDevice.ts`  | ~1451      | Insert `computedHopsAway` derivation                         |
| `src/renderer/hooks/useDevice.ts`  | ~1464      | Widen `if (mp.rxSnr                                          |     | mp.rxRssi)`to also gate on`hasHopUpdate` |
| `src/renderer/hooks/useDevice.ts`  | ~1469–1476 | Add `hops_away` conditional spread into the node update      |
| `src/shared/electron-api.types.ts` | 104–115    | Expand `saveNode` parameter type                             |

**No changes needed in:**

- `src/main/index.ts` — IPC handler already handles extra fields correctly via `...node` spread
- `src/main/database.ts` — schema already has `hops_away` column
- `src/renderer/vitest.setup.ts` — mock uses `vi.fn()` with no typed signature

---

## Edge cases

- `hopStart = 0` — valid in some firmware test modes; guard skips these, preserves existing value
- `hopLimit > hopStart` — malformed packet; guard skips, no update
- MQTT-forwarded packets — `packetViaMqtt = true` guard prevents MQTT hop counts overwriting RF data
- Stale nodes — mirrors existing `onNodeInfoPacket` logic using `MESHTASTIC_CAPABILITIES.nodeStaleThresholdMs`
- Self-node — `mp.from !== myNodeNumRef.current` guard prevents overwriting the known `hops_away: 0`
- Fresh stub nodes — `last_heard` is `Date.now()` on creation so stale check is false → hop count applied on first packet

---

## Verification

1. `pnpm tsc` — no new errors
2. `pnpm test` — existing tests pass
3. Manual: connect to device, find a node that only sends text (no NodeInfo). After receiving a packet from them, their hop count in the node list should now show (e.g. "2 hops") instead of blank.
4. Confirm MQTT-only nodes are unaffected — their `hops_away` should not change from MQTT-bridged packet hop fields.
