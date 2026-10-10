import type { RealtimeStatus } from "./context";
import { RealtimeEngine } from "./engine";

const pool = new Map<string, { engine: RealtimeEngine; refs: number }>();

/** The shared engine for an endpoint when no provider is mounted; release it when done. */
export function acquireEngine(endpoint: string, reconnectMaxMs?: number): RealtimeEngine {
  const entry = pool.get(endpoint);
  if (entry) {
    entry.refs += 1;
    return entry.engine;
  }
  const engine = new RealtimeEngine({
    endpoint,
    reopenDebounceMs: 0,
    ...(reconnectMaxMs !== undefined ? { reconnectMaxMs } : {}),
  });
  pool.set(endpoint, { engine, refs: 1 });
  return engine;
}

export function releaseEngine(endpoint: string): void {
  const entry = pool.get(endpoint);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.engine.close();
  pool.delete(endpoint);
}

/** The pooled engine's status without taking a reference, for a hook's first render. */
export function peekEngineStatus(endpoint: string): RealtimeStatus {
  return pool.get(endpoint)?.engine.getStatus() ?? "idle";
}
