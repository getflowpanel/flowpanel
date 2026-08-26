import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import type { Adapter } from "@flowpanel/core";
import { defineAdmin } from "@flowpanel/core";
import { createFlowpanel } from "../create-flowpanel";
import { bindPublisher, publish, resetPublisherForTests, subscribe } from "../runtime/publish";

const adapter: Adapter = {
  kind: "test",
  db: {},
  introspect: () => ({ name: "items", primaryKey: "id", columns: [] }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => null,
  delete: async () => undefined,
};

function admin(id?: string) {
  return defineAdmin({
    ...(id ? { id } : {}),
    adapter,
    auth: { session: async () => ({ id: "1" }), role: () => "admin" },
  });
}

afterEach(() => {
  resetPublisherForTests();
});

describe("runtime.events.publish", () => {
  it("reaches subscribers on the channel the caller named", async () => {
    const runtime = createFlowpanel(admin());
    const received: unknown[] = [];
    subscribe("market-activity", (payload) => received.push(payload));

    await runtime.events.publish("market-activity", { offers: 3 });

    expect(received).toEqual([{ offers: 3 }]);
  });

  it("does not namespace the wire channel, which no subscriber applies", async () => {
    const runtime = createFlowpanel(admin("acme-ops"));
    const namespaced: unknown[] = [];
    const plain: unknown[] = [];
    subscribe("acme-ops:ticks", (p) => namespaced.push(p));
    subscribe("ticks", (p) => plain.push(p));

    await runtime.events.publish("ticks", { n: 1 });

    expect(plain).toEqual([{ n: 1 }]);
    expect(namespaced).toEqual([]);
  });
});

describe("bindPublisher", () => {
  it("replaces the unbound in-memory fallback a stray publish installed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await publish("early", { n: 0 });
    warn.mockRestore();

    bindPublisher(admin() as never);
    const received: unknown[] = [];
    subscribe("late", (p) => received.push(p));
    await publish("late", { n: 1 });

    expect(received).toEqual([{ n: 1 }]);
  });

  it("keeps the first real binding when called twice", () => {
    const first = admin("first");
    bindPublisher(first as never);
    bindPublisher(admin("second") as never);

    const received: unknown[] = [];
    subscribe("ch", (p) => received.push(p));

    return publish("ch", { n: 2 }).then(() => {
      expect(received).toEqual([{ n: 2 }]);
    });
  });
});
