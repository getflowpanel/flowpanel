import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { handlers } from "../handlers.js";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () =>
    ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
      Adapter["inferSchema"]
    >,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async (_ref, ctx) =>
    ctx.id === "missing" ? null : ({ id: ctx.id, email: "a@b.c" } as Record<string, unknown>),
  create: async () => ({ id: "new" }),
  update: async () => ({ id: "u1" }),
  delete: async () => undefined,
};

function mkConfig() {
  return defineAdmin({
    adapter: fakeAdapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "users" },
        {
          columns: [{ field: "email", editable: true }],
          actions: [{ key: "ping", label: "Ping", run: async () => ({ ok: true }) }],
          bulkActions: [{ key: "verify", label: "V", run: async () => ({ ok: true }) }],
        },
      ),
    ],
  });
}

const paramsFor = (...route: string[]) => Promise.resolve({ route });

describe("handlers() — bad-request branches", () => {
  it("POST <resource>/<id>/actions/<key> with empty action returns 400", async () => {
    const { POST } = handlers(mkConfig());
    const req = new Request("http://localhost/x", { method: "POST" });
    // Route has 4 segments but one empty → guards the !resource||!id||!action branch.
    const res = await POST(req, { params: paramsFor("users", "u1", "actions", "") });
    expect(res.status).toBe(400);
  });

  it("POST <resource>/bulk-actions/<key> with empty resource returns 400", async () => {
    const { POST } = handlers(mkConfig());
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await POST(req, { params: paramsFor("", "bulk-actions", "verify") });
    expect(res.status).toBe(400);
  });

  it("POST <resource>/<id>/update routes the inline update", async () => {
    const { POST } = handlers(mkConfig());
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "new@b.com" }),
    });
    const res = await POST(req, { params: paramsFor("users", "u1", "update") });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("POST <resource>/<id>/update with empty id returns 400", async () => {
    const { POST } = handlers(mkConfig());
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await POST(req, { params: paramsFor("users", "", "update") });
    expect(res.status).toBe(400);
  });

  it("GET with no route segments returns 404", async () => {
    const { GET } = handlers(mkConfig());
    const req = new Request("http://localhost/x");
    // No params at all — `route` defaults to [].
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });

  it("GET drawer/<resource>/ with empty id returns 400", async () => {
    const { GET } = handlers(mkConfig());
    const req = new Request("http://localhost/x");
    const res = await GET(req, { params: paramsFor("drawer", "users", "") });
    expect(res.status).toBe(400);
  });

  it("POST drawer/<resource>/<id>/actions/ with empty action returns 400", async () => {
    const { POST } = handlers(mkConfig());
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await POST(req, {
      params: paramsFor("drawer", "users", "u1", "actions", ""),
    });
    expect(res.status).toBe(400);
  });
});
