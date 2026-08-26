import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type {
  Adapter,
  ListQueryContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { z } from "zod";
import { handlers } from "../handlers";
import { toWireValue } from "../wire/serialize";

const seen: ListQueryContext<Record<string, unknown>>[] = [];

function makeConfig(opts: { role?: string; access?: Record<string, string> } = {}) {
  const adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({
      name: "invoices",
      primaryKey: "id",
      columns: [
        { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
        { name: "amount", type: "number", nullable: false, unique: false, primaryKey: false },
        { name: "createdAt", type: "date", nullable: false, unique: false, primaryKey: false },
      ],
    }),
    inferSchema: () => ({ create: z.object({}), update: z.object({}), select: z.object({}) }),
    list: async (_ref: unknown, ctx: ListQueryContext<Record<string, unknown>>) => {
      seen.push(ctx);
      return { rows: [], total: 0, page: ctx.page, pageSize: ctx.pageSize };
    },
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  } as unknown as Adapter;

  const resource = {
    __kind: "resource",
    ref: { __name: "invoices" },
    options: {
      columns: [{ field: "id" }, { field: "amount" }, { field: "createdAt" }],
      filters: [{ field: "createdAt", type: "daterange" }],
      ...(opts.access ? { access: opts.access } : {}),
    },
  } as unknown as ResourceConfig;

  return {
    adapter,
    auth: {
      session: async () => ({ role: opts.role ?? "admin" }),
      role: (s: unknown) => (s as { role: string }).role,
    },
    resources: [resource],
    resourcesByName: new Map([["invoices", resource]]),
    dashboardsByPath: new Map(),
    pagesByPath: new Map(),
    paths: { base: "/admin", api: "/api/flowpanel" },
    __resolved: true,
  } as unknown as ResolvedAdminConfig;
}

function get(config: ResolvedAdminConfig, query: string) {
  return handlers(config).GET(new Request(`http://localhost/api/flowpanel/invoices${query}`), {
    params: Promise.resolve({ route: ["invoices"] }),
  });
}

describe("the JSON list route parses like the rendered page", () => {
  it("decodes a range filter instead of passing the raw string to the adapter", async () => {
    seen.length = 0;
    const res = await get(makeConfig(), "?filter.createdAt=2024-01-01:2024-12-31");
    expect(res.status).toBe(200);
    expect(seen[0]?.filters.createdAt).toMatchObject({ op: "range" });
  });

  it("clamps a hostile pageSize instead of forwarding it", async () => {
    seen.length = 0;
    await get(makeConfig(), "?pageSize=100000");
    expect(seen[0]?.pageSize).toBeLessThanOrEqual(100);
  });

  it("clamps a hostile page instead of forwarding its offset", async () => {
    seen.length = 0;
    await get(makeConfig(), "?page=999999999");
    expect(seen[0]?.page).toBeLessThanOrEqual(100_000);
  });

  it("still refuses a filter on an undeclared field", async () => {
    seen.length = 0;
    await get(makeConfig(), "?filter.secretNote=x");
    expect(seen[0]?.filters).toEqual({});
  });
});

describe("the JSON route fails in the envelope it answers in", () => {
  it("reports a forbidden read as a structured result error", async () => {
    const res = await get(makeConfig({ role: "viewer", access: { read: "admin" } }), "");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("object");
    expect(body.error.code).toBe("forbidden");
  });
});

describe("the wire serializer", () => {
  it("encodes a value that declares how it serializes", () => {
    class Decimal {
      constructor(private readonly raw: string) {}
      toJSON() {
        return this.raw;
      }
    }
    expect(toWireValue({ amount: new Decimal("12.34") })).toEqual({ amount: "12.34" });
  });

  it("still refuses a value that declares nothing", () => {
    expect(() => toWireValue({ db: new Map() })).toThrow("Validation failed");
  });
});
