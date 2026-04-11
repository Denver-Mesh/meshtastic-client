/** Time duration constants in milliseconds. */
export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/** MeshCore Ping (`tracePath`) end-to-end cap (queue wait + radio); matches `useMeshCore` `withTimeout`. */
export const MESHCORE_TRACE_PING_TOTAL_TIMEOUT_MS = 90_000;

/**
 * Max wait for `RESP_CODE_SENT` after `CMD_SEND_TRACE_PATH`. If the companion never acks, the
 * multiplex must reject so `runSerialized` does not stall and pending tags are cleared.
 */
export const MESHCORE_TRACE_SENT_WAIT_TIMEOUT_MS = 30_000;
