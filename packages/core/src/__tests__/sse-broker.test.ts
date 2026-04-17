import { beforeEach, describe, expect, it, vi } from "vitest";
import { SseBroker, type SseEvent } from "../sse/broker";
import type { SqlExecutor } from "../types/db";

function createMockDb(): SqlExecutor {
  return {
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
    advisoryLock: vi.fn(),
    advisoryUnlock: vi.fn(),
    advisoryTryLock: vi.fn(),
    sql: vi.fn(),
  } as unknown as SqlExecutor;
}

describe("SseBroker", () => {
  let db: SqlExecutor;
  let broker: SseBroker;

  beforeEach(() => {
    db = createMockDb();
    broker = new SseBroker(db, 50, 60_000);
  });

  it("publishes events to subscribed clients", () => {
    const events: unknown[] = [];
    broker.subscribe("client-1", (e) => events.push(e));

    broker.publish({ event: "run.created", data: { id: "1" } });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "1",
      event: "run.created",
      data: { id: "1" },
    });
  });

  it("assigns incrementing IDs to events", () => {
    const events: unknown[] = [];
    broker.subscribe("client-1", (e) => events.push(e));

    broker.publish({ event: "a", data: {} });
    broker.publish({ event: "b", data: {} });

    expect((events[0] as { id: string }).id).toBe("1");
    expect((events[1] as { id: string }).id).toBe("2");
  });

  it("does not deliver events after unsubscribe", () => {
    const events: unknown[] = [];
    const unsub = broker.subscribe("client-1", (e) => events.push(e));

    broker.publish({ event: "a", data: {} });
    unsub();
    broker.publish({ event: "b", data: {} });

    expect(events).toHaveLength(1);
  });

  it("replays missed events on subscribe with lastEventId", () => {
    broker.publish({ event: "a", data: { n: 1 } });
    broker.publish({ event: "b", data: { n: 2 } });
    broker.publish({ event: "c", data: { n: 3 } });

    const replayed: unknown[] = [];
    broker.subscribe("client-1", (e) => replayed.push(e), "1");

    // Should replay events with id > 1 (i.e., events 2 and 3)
    expect(replayed).toHaveLength(2);
    expect((replayed[0] as { id: string }).id).toBe("2");
    expect((replayed[1] as { id: string }).id).toBe("3");
  });

  it("rejects subscribe when max connections reached", () => {
    const smallBroker = new SseBroker(db, 2, 60_000);
    smallBroker.subscribe("c1", () => {});
    smallBroker.subscribe("c2", () => {});

    expect(() => smallBroker.subscribe("c3", () => {})).toThrow("Too many SSE connections");
  });

  it("tracks client count correctly", () => {
    expect(broker.clientCount()).toBe(0);

    const unsub1 = broker.subscribe("c1", () => {});
    expect(broker.clientCount()).toBe(1);

    broker.subscribe("c2", () => {});
    expect(broker.clientCount()).toBe(2);

    unsub1();
    expect(broker.clientCount()).toBe(1);
  });

  it("persists events to database", async () => {
    await broker.persistEvent({ event: "run.created", data: { id: "42" } });

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO flowpanel_events"),
      expect.arrayContaining(["run.created"]),
    );
  });

  it("destroy clears all state", () => {
    broker.subscribe("c1", () => {});
    broker.publish({ event: "a", data: {} });

    broker.destroy();

    expect(broker.clientCount()).toBe(0);
  });

  it("correctly replays events within time window", () => {
    const shortWindowBroker = new SseBroker(db, 50, 100);

    shortWindowBroker.publish({ event: "old", data: { n: 1 } });

    // Manually expire old events by advancing timestamps
    const log = (shortWindowBroker as unknown as { eventLog: SseEvent[] }).eventLog;
    log[0].timestamp = Date.now() - 200;

    shortWindowBroker.publish({ event: "recent", data: { n: 2 } });

    const replayed: SseEvent[] = [];
    shortWindowBroker.subscribe("c1", (e) => replayed.push(e), "0");

    // Only the recent event should be replayed (old one expired from window)
    expect(replayed).toHaveLength(1);
    expect(replayed[0].event).toBe("recent");
  });

  it("uses LISTEN when adapter supports it", async () => {
    let registeredHandler: ((payload: string) => void) | null = null;
    const listenDb = {
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
      advisoryLock: vi.fn(),
      advisoryUnlock: vi.fn(),
      advisoryTryLock: vi.fn(),
      sql: vi.fn(),
      listen: vi.fn(async (_channel: string, handler: (p: string) => void) => {
        registeredHandler = handler;
        return async () => {};
      }),
    } as unknown as SqlExecutor;

    const listenBroker = new SseBroker(listenDb, 50, 60_000);
    await listenBroker.start();

    expect(listenDb.listen).toHaveBeenCalledWith("flowpanel_events", expect.any(Function));

    const received: SseEvent[] = [];
    listenBroker.subscribe("c1", (e) => received.push(e));

    // Simulate a pg_notify payload arriving
    registeredHandler?.(JSON.stringify({ event: "run.created", id: "42" }));

    expect(received).toHaveLength(1);
    expect(received[0].event).toBe("run.created");

    await listenBroker.destroy();
  });

  it("falls back to polling when adapter has no listen() method", async () => {
    vi.useFakeTimers();
    const rows = [
      { id: 1, event: "run.created", data: { id: "1" } },
      { id: 2, event: "run.finished", data: { id: "1" } },
    ];
    let pollCall = 0;
    const pollDb = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes("MAX(id)")) return [{ id: 0 }];
        if (sql.includes("SELECT id, event, data")) {
          pollCall++;
          return pollCall === 1 ? rows : [];
        }
        return [];
      }),
      transaction: vi.fn(),
      advisoryLock: vi.fn(),
      advisoryUnlock: vi.fn(),
      advisoryTryLock: vi.fn(),
      sql: vi.fn(),
    } as unknown as SqlExecutor;

    const pollBroker = new SseBroker(pollDb, 50, 60_000);
    const received: SseEvent[] = [];
    pollBroker.subscribe("c1", (e) => received.push(e));

    await pollBroker.start();
    await vi.advanceTimersByTimeAsync(2_000); // trigger one poll tick

    // Drain pending microtasks
    await Promise.resolve();
    await Promise.resolve();

    expect(received.length).toBeGreaterThanOrEqual(2);
    expect(received.map((e) => e.event)).toContain("run.created");
    expect(received.map((e) => e.event)).toContain("run.finished");

    await pollBroker.destroy();
    vi.useRealTimers();
  });

  it("drops oldest events when buffer exceeds replay window", () => {
    const tinyWindowBroker = new SseBroker(db, 50, 1);

    tinyWindowBroker.publish({ event: "first", data: {} });

    // Expire all events by setting timestamps to the past
    const log = (tinyWindowBroker as unknown as { eventLog: SseEvent[] }).eventLog;
    for (const e of log) {
      e.timestamp = Date.now() - 10;
    }

    tinyWindowBroker.publish({ event: "second", data: {} });

    // After publish, old events outside the replay window should be evicted
    const currentLog = (tinyWindowBroker as unknown as { eventLog: SseEvent[] }).eventLog;
    expect(currentLog).toHaveLength(1);
    expect(currentLog[0].event).toBe("second");
  });
});
