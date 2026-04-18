import { sanitizeLogMessage } from '@/main/sanitize-log-message';

const AUTO_TRACEROUTE_INTERVAL_MS = 30 * 60 * 1_000; // 30 minutes

/**
 * Starts a periodic network discovery loop that traceroutes all known nodes.
 *
 * @param traceRouteFn    Async function to run traceroute to a single node.
 * @param getNodeIds      Returns the current list of node IDs to probe (excluding our own node).
 * @param intervalMs      How often to run a full sweep (default: 30 minutes).
 * @returns               A stop function — call it to cancel the scheduler.
 */
export function startNetworkDiscovery(
  traceRouteFn: (nodeId: number) => Promise<void>,
  getNodeIds: () => number[],
  intervalMs: number = AUTO_TRACEROUTE_INTERVAL_MS,
): () => void {
  let stopped = false;
  let sweepTimeout: ReturnType<typeof setTimeout> | null = null;

  async function runSweep(): Promise<void> {
    if (stopped) return;
    const nodeIds = getNodeIds();
    await Promise.all(
      nodeIds.map(async (nodeId) => {
        if (stopped) return;
        await Promise.resolve();
        if (stopped) return;
        try {
          await traceRouteFn(nodeId);
        } catch (e) {
          console.warn(
            '[networkDiscovery] traceroute failed for node',
            nodeId,
            sanitizeLogMessage(e instanceof Error ? e.message : String(e)),
          );
        }
      }),
    );
  }

  function scheduleNext(): void {
    if (stopped) return;
    sweepTimeout = setTimeout(() => {
      void (async () => {
        if (stopped) return;
        await runSweep();
        scheduleNext();
      })();
    }, intervalMs);
  }

  // Run an immediate sweep, then schedule recurring ones
  void runSweep().then(() => {
    if (!stopped) scheduleNext();
  });

  return function stop() {
    stopped = true;
    if (sweepTimeout !== null) {
      clearTimeout(sweepTimeout);
      sweepTimeout = null;
    }
  };
}
