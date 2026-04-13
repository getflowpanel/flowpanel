// SSE event broker: LISTEN on pg_notify (if supported) or poll flowpanel_events, fan-out to clients.

import type { SqlExecutor } from "../types/db";

export interface SseEvent {
  id: string;
  event: string;
  data: unknown;
  timestamp: number;
}

type ClientCallback = (event: SseEvent) => void;

const POLL_INTERVAL_MS = 2_000;
const GC_INTERVAL_MS = 60_000;
const GC_RETENTION_MS = 60 * 60 * 1000; // 1 hour

export class SseBroker {
  private clients = new Map<string, ClientCallback>();
  private eventLog: SseEvent[] = []; // bounded replay window
  private nextId = 1;

  private unlistenFn: (() => Promise<void> | void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private lastPolledId = 0;
  private started = false;

  constructor(
    private db: SqlExecutor,
    private maxConnections: number,
    private replayWindowMs: number,
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Prefer LISTEN if the adapter provides it — zero-latency, cross-process.
    if (typeof this.db.listen === "function") {
      try {
        const unlisten = await this.db.listen("flowpanel_events", (payload: string) => {
          this.handleNotification(payload);
        });
        this.unlistenFn = unlisten;
        // Still run GC for bounded table size.
        this.startGc();
        return;
      } catch (err) {
        // Fall through to polling if LISTEN fails (e.g. adapter doesn't really support it).
        console.warn("[flowpanel] LISTEN failed, falling back to polling:", err);
      }
    }

    // Polling fallback — poll flowpanel_events every POLL_INTERVAL_MS.
    await this.primeLastPolledId();
    this.startPolling();
    this.startGc();
  }

  private handleNotification(payload: string): void {
    try {
      const parsed = JSON.parse(payload) as { event?: string; [k: string]: unknown };
      const eventName = typeof parsed.event === "string" ? parsed.event : "unknown";
      this.publish({ event: eventName, data: parsed });
    } catch {
      // Malformed payload — ignore.
    }
  }

  private async primeLastPolledId(): Promise<void> {
    try {
      const rows = await this.db.execute<{ id: string | number | bigint }>(
        `SELECT COALESCE(MAX(id), 0) AS id FROM flowpanel_events`,
        [],
      );
      this.lastPolledId = Number(rows[0]?.id ?? 0);
    } catch {
      // Table may not exist yet (pre-migrate). Start from 0.
      this.lastPolledId = 0;
    }
  }

  private startPolling(): void {
    const tick = async () => {
      try {
        const rows = await this.db.execute<{
          id: string | number | bigint;
          event: string;
          data: unknown;
        }>(
          `SELECT id, event, data
             FROM flowpanel_events
            WHERE id > $1
            ORDER BY id
            LIMIT 500`,
          [this.lastPolledId],
        );
        for (const row of rows) {
          const rowId = Number(row.id);
          if (rowId > this.lastPolledId) this.lastPolledId = rowId;
          this.publish({ event: row.event, data: row.data });
        }
      } catch {
        // Silent — next tick will retry.
      }
    };
    this.pollTimer = setInterval(tick, POLL_INTERVAL_MS);
    if (this.pollTimer.unref) this.pollTimer.unref();
  }

  private startGc(): void {
    const gc = async () => {
      try {
        await this.db.execute(
          `DELETE FROM flowpanel_events WHERE created_at < now() - make_interval(secs => $1)`,
          [GC_RETENTION_MS / 1000],
        );
      } catch {
        // Silent — table may not exist; retry next tick.
      }
    };
    this.gcTimer = setInterval(gc, GC_INTERVAL_MS);
    if (this.gcTimer.unref) this.gcTimer.unref();
  }

  publish(event: Omit<SseEvent, "id" | "timestamp">): void {
    const now = Date.now();
    const sseEvent: SseEvent = { ...event, id: String(this.nextId++), timestamp: now };

    this.eventLog = this.eventLog.filter((e) => e.timestamp > now - this.replayWindowMs);
    this.eventLog.push(sseEvent);

    for (const callback of this.clients.values()) {
      callback(sseEvent);
    }
  }

  subscribe(clientId: string, callback: ClientCallback, lastEventId?: string): () => void {
    if (this.clients.size >= this.maxConnections) {
      throw new Error("Too many SSE connections");
    }

    this.clients.set(clientId, callback);

    if (lastEventId) {
      const replayFrom = parseInt(lastEventId, 10);
      const missed = this.eventLog.filter((e) => parseInt(e.id, 10) > replayFrom);
      for (const event of missed) {
        callback(event);
      }
    }

    return () => {
      this.clients.delete(clientId);
    };
  }

  clientCount(): number {
    return this.clients.size;
  }

  async destroy(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.gcTimer) clearInterval(this.gcTimer);
    this.pollTimer = null;
    this.gcTimer = null;

    if (this.unlistenFn) {
      try {
        await this.unlistenFn();
      } catch {
        // Ignore — broker is going down anyway.
      }
      this.unlistenFn = null;
    }

    this.clients.clear();
    this.eventLog = [];
    this.started = false;
  }

  /**
   * Persist an event to flowpanel_events. This is what withRun() / reaper / etc.
   * should call to emit events — the broker picks them up via LISTEN or polling.
   */
  async persistEvent(event: Omit<SseEvent, "id" | "timestamp">): Promise<void> {
    await this.db.execute(`INSERT INTO flowpanel_events (event, data) VALUES ($1, $2)`, [
      event.event,
      JSON.stringify(event.data),
    ]);
  }
}

// Global broker singleton per FlowPanel instance
const brokers = new WeakMap<object, SseBroker>();

export function getOrCreateBroker(
  configKey: object,
  db: SqlExecutor,
  maxConnections = 50,
  replayWindowMs = 60_000,
): SseBroker {
  let broker = brokers.get(configKey);
  if (!broker) {
    broker = new SseBroker(db, maxConnections, replayWindowMs);
    brokers.set(configKey, broker);
  }
  return broker;
}
