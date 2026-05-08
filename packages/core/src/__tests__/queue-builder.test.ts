import { describe, expect, it } from "vitest";
import { queue } from "../builders/queue.js";
import { defineAdmin } from "../define-admin.js";

describe("queue() builder", () => {
  it("returns __kind=queue with ref + options", () => {
    const ref = { name: "scraper" };
    const q = queue(ref, { label: "Scraper", boardUrl: "http://localhost:3001/scraper" });
    expect(q.__kind).toBe("queue");
    expect(q.ref).toBe(ref);
    expect(q.options.label).toBe("Scraper");
  });
});

describe("defineAdmin — queues", () => {
  it("builds queuesByKey using queue.ref.name when key is unset", () => {
    const scraper = { name: "scraper" };
    const cfg = defineAdmin({
      adapter: {
        kind: "drizzle",
        db: {},
        introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
        inferSchema: () => ({}) as never,
        list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
        get: async () => null,
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => undefined,
      },
      auth: { session: async () => null, role: () => "guest" },
      queues: [queue(scraper, { label: "Scraper", boardUrl: "http://x/scraper" })],
    });
    expect(cfg.queuesByKey.get("scraper")?.options.label).toBe("Scraper");
  });

  it("throws on duplicate queue keys", () => {
    const build = () =>
      defineAdmin({
        adapter: {
          kind: "drizzle",
          db: {},
          introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
          inferSchema: () => ({}) as never,
          list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
          get: async () => null,
          create: async () => ({}),
          update: async () => ({}),
          delete: async () => undefined,
        },
        auth: { session: async () => null, role: () => "guest" },
        queues: [
          queue({ name: "scraper" }, { label: "A", boardUrl: "http://x/a" }),
          queue({ name: "scraper" }, { label: "B", boardUrl: "http://x/b" }),
        ],
      });
    expect(build).toThrow(/duplicate queue/i);
  });
});
