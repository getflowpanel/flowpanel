import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { z } from "zod";
import { resourceCreateRoute } from "../actions/resource-form";

const created: Record<string, unknown>[] = [];

function makeConfig(fields?: Record<string, unknown>[]) {
  const adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({
      name: "posts",
      primaryKey: "id",
      columns: [
        { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
        { name: "title", type: "string", nullable: false, unique: false, primaryKey: false },
        { name: "active", type: "boolean", nullable: true, unique: false, primaryKey: false },
        { name: "labels", type: "json", nullable: true, unique: false, primaryKey: false },
      ],
    }),
    inferSchema: () => ({
      create: z.object({}).passthrough(),
      update: z.object({}).passthrough(),
      select: z.object({}),
    }),
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => null,
    create: async (_ref: unknown, ctx: { input: Record<string, unknown> }) => {
      created.push(ctx.input);
      return { id: "p1", ...ctx.input };
    },
    update: async () => ({ id: "p1" }),
    delete: async () => undefined,
  } as unknown as Adapter;

  const resource = {
    __kind: "resource",
    ref: { __name: "posts" },
    options: {
      columns: [{ field: "id" }, { field: "title" }, { field: "active" }, { field: "labels" }],
      ...(fields ? { create: { fields } } : {}),
    },
  } as unknown as ResourceConfig;

  return {
    adapter,
    auth: { session: async () => ({ role: "admin" }), role: () => "admin" },
    resources: [resource],
    resourcesByName: new Map([["posts", resource]]),
    dashboardsByPath: new Map(),
    pagesByPath: new Map(),
    paths: { base: "/admin", api: "/api/flowpanel" },
    __resolved: true,
  } as unknown as ResolvedAdminConfig;
}

function submit(config: ResolvedAdminConfig, body: FormData) {
  return resourceCreateRoute(config)(
    new Request("http://localhost/api/flowpanel/posts/create", { method: "POST", body }),
    { params: Promise.resolve({ resource: "posts" }) },
  );
}

describe("resource forms decode what their controls post", () => {
  it("accepts the checkbox token a browser actually submits", async () => {
    created.length = 0;
    const fd = new FormData();
    fd.set("title", "Hello");
    fd.set("active", "on");
    const res = await submit(makeConfig(), fd);
    expect(res.status).toBe(200);
    expect(created[0]?.active).toBe(true);
  });

  it("reads a cleared checkbox as false rather than leaving it untouched", async () => {
    created.length = 0;
    const fd = new FormData();
    fd.set("title", "Hello");
    const res = await submit(makeConfig(), fd);
    expect(res.status).toBe(200);
    expect(created[0]?.active).toBe(false);
  });

  it("decodes the list encoding the tags control submits", async () => {
    created.length = 0;
    const fd = new FormData();
    fd.set("title", "Hello");
    fd.set("labels", JSON.stringify(["alpha", "beta"]));
    const res = await submit(makeConfig([{ name: "title" }, { name: "labels", type: "tags" }]), fd);
    expect(res.status).toBe(200);
    expect(created[0]?.labels).toEqual(["alpha", "beta"]);
  });

  it("leaves a field the server withholds out of the write", async () => {
    created.length = 0;
    const fd = new FormData();
    fd.set("title", "Hello");
    const config = makeConfig([{ name: "title" }, { name: "active", hidden: true }]);
    const res = await submit(config, fd);
    expect(res.status).toBe(200);
    expect(created[0]).not.toHaveProperty("active");
  });
});
