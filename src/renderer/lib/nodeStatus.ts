// Time thresholds for node freshness
const STALE_MS = 30 * 60_000; // 30 minutes
const OFFLINE_MS = 2 * 3_600_000; // 2 hours

export type NodeStatus = "online" | "stale" | "offline";

export function getNodeStatus(lastHeard: number): NodeStatus {
  if (!lastHeard) return "offline";
  const diff = Date.now() - lastHeard;
  if (diff < STALE_MS) return "online";
  if (diff < OFFLINE_MS) return "stale";
  return "offline";
}
