// SSE event broker: LISTEN on pg_notify, fan-out to connected clients

import type { SqlExecutor } from "../types/db.js";

export interface SseEvent {
  id: string;
  event: string;
  data: unknown;
}

type ClientCallback = (event: SseEvent) => void;

export class SseBroker {
  private clients = new Map<string, ClientCallback>();
  private eventLog: SseEvent[] = [];
  private nextId = 1;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPolledId = 0;
  private usePolling = false;

  constructor(
    private db: SqlExecutor,
    private maxConnections: number,
    private replayWindowMs: number,
  ) {}

  async start(): Promise<void> {
    try {
      await this.db.execute(`LISTEN flowpanel_events`, []);
      this.usePolling = false;
    } catch {
      this.usePolling = true;
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.pollingTimer) return;

    this.pollingTimer = setInterval(async () => {
      try {
        const rows = await this.db.execute<{
          id: number;
          type: string;
          payload: unknown;
        }>(
          `SELECT id, type, payload FROM flowpanel_events WHERE id > $1 ORDER BY id ASC LIMIT 100`,
          [this.lastPolledId],
        );

        for (const row of rows) {
          this.lastPolledId = row.id;
          this.publish({ event: row.type, data: row.payload });
        }

        // Auto-cleanup old events
        await this.db
          .execute(`DELETE FROM flowpanel_events WHERE created_at < now() - INTERVAL '1 hour'`, [])
          .catch(() => {});
      } catch {
        // Silent failure — retry on next poll
      }
    }, 2000);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  publish(event: Omit<SseEvent, "id">): void {
    const sseEvent: SseEvent = { ...event, id: String(this.nextId++) };

    const cutoff = Date.now() - this.replayWindowMs;
    this.eventLog = this.eventLog.filter(
      (e) => parseInt(e.id, 10) > this.nextId - 1000 && parseInt(e.id, 10) > cutoff,
    );
    this.eventLog.push(sseEvent);

    for (const callback of this.clients.values()) {
      callback(sseEvent);
    }
  }

  async persistEvent(event: Omit<SseEvent, "id">): Promise<void> {
    try {
      await this.db.execute(`INSERT INTO flowpanel_events (type, payload) VALUES ($1, $2)`, [
        event.event,
        JSON.stringify(event.data),
      ]);

      if (!this.usePolling) {
        try {
          await this.db.execute(`SELECT pg_notify('flowpanel_events', $1)`, [
            JSON.stringify({ event: event.event, data: event.data }),
          ]);
        } catch {
          // Silent — clients get event via publish() anyway
        }
      }
    } catch {
      // Silent — in-memory broadcast still works
    }
  }

  subscribe(clientId: string, callback: ClientCallback, lastEventId?: string): () => void {
    if (this.clients.size >= this.maxConnections) {
      throw new Error("Too many SSE connections");
    }

    this.clients.set(clientId, callback);

    // Replay missed events
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

  isPolling(): boolean {
    return this.usePolling;
  }

  destroy(): void {
    this.stopPolling();
    this.clients.clear();
    this.eventLog = [];
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
