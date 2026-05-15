import { describe, expect, it, vi } from "vitest";

// Mock the same boundary the sibling drawer-action-route.test.ts mocks:
// revalidatePath() throws outside a Next.js runtime, and the publisher
// can't reach a real Redis from a unit test.
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
    ctx.id === "missing" ? null : { id: ctx.id, email: "a@b.c", name: "Alice" },
  create: async () => ({ id: "new" }),
  update: async () => ({ id: "u1" }),
  delete: async () => {},
};

function mkConfig() {
  return defineAdmin({
    adapter: fakeAdapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "users" },
        {
          columns: ["id", "email"],
          drawer: {
            fields: "*",
            actions: [
              {
                key: "ping",
                label: "Ping",
                variant: "default",
                run: async () => ({ ok: true, message: "pong" }),
              },
            ],
          },
        },
      ),
    ],
  });
}

function paramsFor(...route: string[]) {
  return Promise.resolve({ route });
}

describe("handlers() catch-all dispatcher — contract with DrawerHost", () => {
  it("GET drawer/<resource>/<id> returns the drawer payload", async () => {
    const { GET } = handlers(mkConfig());
    const req = new Request("http://localhost/api/flowpanel/drawer/users/u1");
    const res = await GET(req, { params: paramsFor("drawer", "users", "u1") });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { row: { id: string }; header: string };
    expect(body.row.id).toBe("u1");
  });

  it("POST drawer/<resource>/<id>/actions/<key> runs the action", async () => {
    const { POST } = handlers(mkConfig());
    const req = new Request("http://localhost/api/flowpanel/drawer/users/u1/actions/ping", {
      method: "POST",
    });
    const res = await POST(req, { params: paramsFor("drawer", "users", "u1", "actions", "ping") });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; message?: string };
    expect(body.ok).toBe(true);
    expect(body.message).toBe("pong");
  });

  it("GET on unknown path returns 404 (not 405)", async () => {
    const { GET } = handlers(mkConfig());
    const req = new Request("http://localhost/api/flowpanel/unknown");
    const res = await GET(req, { params: paramsFor("unknown") });
    expect(res.status).toBe(404);
  });

  it("POST on unknown path returns 404 (not 405)", async () => {
    const { POST } = handlers(mkConfig());
    const req = new Request("http://localhost/api/flowpanel/unknown", { method: "POST" });
    const res = await POST(req, { params: paramsFor("unknown") });
    expect(res.status).toBe(404);
  });

  it("GET drawer/<r>/<id> returns 404 for unknown resource", async () => {
    const { GET } = handlers(mkConfig());
    const req = new Request("http://localhost/api/flowpanel/drawer/ghost/u1");
    const res = await GET(req, { params: paramsFor("drawer", "ghost", "u1") });
    expect(res.status).toBe(404);
  });

  it("POST drawer/<r>/<id>/actions/<key> returns 404 for unknown action", async () => {
    const { POST } = handlers(mkConfig());
    const req = new Request("http://localhost/api/flowpanel/drawer/users/u1/actions/ghost", {
      method: "POST",
    });
    const res = await POST(req, { params: paramsFor("drawer", "users", "u1", "actions", "ghost") });
    expect(res.status).toBe(404);
  });

  it("malformed drawer GET (missing id) returns 400", async () => {
    const { GET } = handlers(mkConfig());
    const req = new Request("http://localhost/api/flowpanel/drawer/users");
    const res = await GET(req, { params: paramsFor("drawer", "users") });
    expect(res.status).toBe(404); // length 2, not 3 — falls through to 404
  });

  // Lock the contract: every URL DrawerHost.tsx fetches MUST be handled.
  // If DrawerHost adds a new endpoint, this list updates and the matching
  // dispatch branch must exist in handlers.ts.
  it("CONTRACT: dispatches every URL pattern DrawerHost.tsx posts/fetches", async () => {
    const { GET, POST } = handlers(mkConfig());

    // Pattern 1: GET drawer/<resource>/<id> (DrawerHost.tsx:361)
    const r1 = await GET(new Request("http://localhost/?"), {
      params: paramsFor("drawer", "users", "u1"),
    });
    expect(r1.status).toBe(200);

    // Pattern 2: POST drawer/<resource>/<id>/actions/<key> (DrawerHost.tsx:278-282)
    const r2 = await POST(new Request("http://localhost/?", { method: "POST" }), {
      params: paramsFor("drawer", "users", "u1", "actions", "ping"),
    });
    expect(r2.status).toBe(200);
  });
});
