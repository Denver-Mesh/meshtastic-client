/**
 * Regression: MeshCore chat history must hydrate from SQLite on mount (no device
 * connection). Previously getMeshcoreMessages only ran in initConn, so restarts
 * showed an empty thread until a radio connected.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMeshCore } from './useMeshCore';

const SENDER_ID = 0x12345678;

function sampleMeshcoreDbRow() {
  return {
    id: 42,
    sender_id: SENDER_ID,
    sender_name: 'Alice',
    payload: 'Hello from DB',
    channel_idx: 0,
    timestamp: 1_700_000_000_000,
    status: 'acked',
    packet_id: null as number | null,
    emoji: null as number | null,
    reply_id: null as number | null,
    to_node: null as number | null,
    received_via: 'mqtt' as const,
  };
}

describe('useMeshCore mount hydration', () => {
  beforeEach(() => {
    vi.mocked(window.electronAPI.db.getMeshcoreContacts).mockResolvedValue([]);
    vi.mocked(window.electronAPI.db.getMeshcoreMessages).mockResolvedValue([sampleMeshcoreDbRow()]);
  });

  afterEach(() => {
    vi.mocked(window.electronAPI.db.getMeshcoreContacts).mockResolvedValue([]);
    vi.mocked(window.electronAPI.db.getMeshcoreMessages).mockResolvedValue([]);
  });

  it('loads persisted meshcore messages from SQLite on mount without connecting a device', async () => {
    const { result } = renderHook(() => useMeshCore());

    await waitFor(() => {
      expect(result.current.messages.length).toBe(1);
    });

    const m = result.current.messages[0];
    expect(m.payload).toBe('Hello from DB');
    expect(m.sender_name).toBe('Alice');
    expect(m.sender_id).toBe(SENDER_ID);
    expect(m.isHistory).toBe(true);
    expect(m.receivedVia).toBe('mqtt');

    expect(result.current.nodes.has(SENDER_ID)).toBe(true);
    expect(result.current.nodes.get(SENDER_ID)?.long_name).toBe('Alice');
  });

  it('leaves messages empty when the DB returns no rows', async () => {
    vi.mocked(window.electronAPI.db.getMeshcoreMessages).mockResolvedValue([]);

    const { result } = renderHook(() => useMeshCore());

    await waitFor(() => {
      expect(window.electronAPI.db.getMeshcoreMessages).toHaveBeenCalled();
    });

    expect(result.current.messages).toEqual([]);
  });
});
