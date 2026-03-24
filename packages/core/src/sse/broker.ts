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
  private eventLog: SseEvent[] = []; // bounded replay window
  private nextId = 1;

  constructor(
    private db: SqlExecutor,
    private maxConnections: number,
    private replayWindowMs: number
  ) {}

  async start(): Promise<void> {
    try {
      await this.db.execute(`LISTEN flowpanel_events`, []);
    } catch {
      // Fallback: polling mode
    }
  }

  publish(event: Omit<SseEvent, "id">): void {
    const sseEvent: SseEvent = { ...event, id: String(this.nextId++) };

    const cutoff = Date.now() - this.replayWindowMs;
    this.eventLog = this.eventLog.filter((e) => parseInt(e.id) > cutoff);
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
      const replayFrom = parseInt(lastEventId);
      const missed = this.eventLog.filter((e) => parseInt(e.id) > replayFrom);
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
}

// Global broker singleton per FlowPanel instance
const brokers = new WeakMap<object, SseBroker>();

export function getOrCreateBroker(
  configKey: object,
  db: SqlExecutor,
  maxConnections = 50,
  replayWindowMs = 60_000
): SseBroker {
  let broker = brokers.get(configKey);
  if (!broker) {
    broker = new SseBroker(db, maxConnections, replayWindowMs);
    brokers.set(configKey, broker);
  }
  return broker;
}
