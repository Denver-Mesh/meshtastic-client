import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'mesh-client:watchedNodes';

describe('watchedNodesStore', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('starts with an empty watchedNodeIds set', async () => {
    const { useWatchedNodesStore } = await import('./watchedNodesStore');
    expect(useWatchedNodesStore.getState().watchedNodeIds.size).toBe(0);
  });

  it('toggleWatch adds a node id', async () => {
    const { useWatchedNodesStore } = await import('./watchedNodesStore');
    useWatchedNodesStore.getState().toggleWatch(42);
    expect(useWatchedNodesStore.getState().watchedNodeIds.has(42)).toBe(true);
  });

  it('toggleWatch removes an already-watched node id', async () => {
    const { useWatchedNodesStore } = await import('./watchedNodesStore');
    useWatchedNodesStore.getState().toggleWatch(42);
    useWatchedNodesStore.getState().toggleWatch(42);
    expect(useWatchedNodesStore.getState().watchedNodeIds.has(42)).toBe(false);
  });

  it('persists watchedNodeIds as a JSON array in localStorage', async () => {
    const { useWatchedNodesStore } = await import('./watchedNodesStore');
    useWatchedNodesStore.getState().toggleWatch(7);
    useWatchedNodesStore.getState().toggleWatch(99);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { state?: { watchedNodeIds?: unknown } };
    expect(Array.isArray(parsed.state?.watchedNodeIds)).toBe(true);
    expect(parsed.state?.watchedNodeIds).toContain(7);
    expect(parsed.state?.watchedNodeIds).toContain(99);
  });

  it('rehydrates a persisted array back into a Set', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 0, state: { watchedNodeIds: [1, 2, 3] } }),
    );

    const { useWatchedNodesStore } = await import('./watchedNodesStore');
    const { watchedNodeIds } = useWatchedNodesStore.getState();
    expect(watchedNodeIds).toBeInstanceOf(Set);
    expect(watchedNodeIds.has(1)).toBe(true);
    expect(watchedNodeIds.has(2)).toBe(true);
    expect(watchedNodeIds.has(3)).toBe(true);
  });

  it('returns empty Set when persisted data is corrupt', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');

    const { useWatchedNodesStore } = await import('./watchedNodesStore');
    expect(useWatchedNodesStore.getState().watchedNodeIds.size).toBe(0);
  });
});
