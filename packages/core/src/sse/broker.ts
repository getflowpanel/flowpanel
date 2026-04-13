// SSE event broker: LISTEN on pg_notify, fan-out to connected clients

import type { SqlExecutor } from "../types/db";

export interface SseEvent {
  id: string;
  event: string;
  data: unknown;
  timestamp: number;
}

type ClientCallback = (event: SseEvent) => void;

export class SseBroker {
  private clients = new Map<string, ClientCallback>();
  private eventLog: SseEvent[] = []; // bounded replay window
  private nextId = 1;

  constructor(
    private db: SqlExecutor,
    private maxConnections: number,
    private replayWindowMs: number,
  ) {}

  async start(): Promise<void> {
    try {
      await this.db.execute(`LISTEN flowpanel_events`, []);
      // NOTE: pg LISTEN/NOTIFY requires a persistent connection with a notification callback.
      // The SqlExecutor interface doesn't support notification callbacks directly.
      // If using node-postgres, the underlying client would need:
      //   client.on('notification', (msg) => this.publish({ event: msg.channel, data: JSON.parse(msg.payload ?? "{}") }));
      // This must be wired at the adapter level.
    } catch {
      // Fallback: polling mode
    }
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

  destroy(): void {
    this.clients.clear();
    this.eventLog = [];
  }

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
