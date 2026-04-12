/**
 * Serialize MeshCore companion RPCs that share `ResponseCodes.Sent` (getStatus, sendBinaryRequest,
 * CLI, trace **send**, etc.). Trace **results** are matched by 32-bit tag in
 * `meshcoreTracePathMultiplex.ts`, so multiple traces can wait for `TraceData` concurrently once
 * each send has passed the queue.
 */
export function createRepeaterRemoteRpcQueue(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();

  return function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = tail.then(() => fn());
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}
