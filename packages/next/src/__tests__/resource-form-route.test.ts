import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { z } from "zod";
import { makeActions } from "../actions/resource-actions";
import { resourceCreateRoute, resourceUpdateRoute } from "../actions/resource-form";
import { publishResource } from "../runtime/publish";

const createSchema = z.object({
  email: z.string().email(),
  priceCents: z.number().nullable().optional(),
});
const updateSchema = z.object({
  email: z.string().email().optional(),
  priceCents: z.number().nullable().optional(),
});

function makeConfig(opts: {
  role?: string;
  access?: string | string[];
  createDisabled?: boolean;
  updateDisabled?: boolean;
  readOnly?: boolean;
  createReturn?: Record<string, unknown> | null;
  updateReturn?: Record<string, unknown> | null;
  createCaptured?: { value?: unknown };
  updateCaptured?: { value?: unknown };
  createFields?: unknown[];
}) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({
      name: "users",
      columns: [
        { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
        { name: "email", type: "string", nullable: false, unique: true, primaryKey: false },
        { name: "priceCents", type: "number", nullable: true, unique: false, primaryKey: false },
      ],
      primaryKey: "id",
    }),
    inferSchema: () => ({ create: createSchema, update: updateSchema }) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => ({ id: "u1", email: "a@b.com", priceCents: null }),
    create: async (_ref, ctx) => {
      if (opts.createCaptured) opts.createCaptured.value = (ctx as { input: unknown }).input;
      return opts.createReturn === undefined
        ? ({ id: "u1", email: "a@b.com" } as Record<string, unknown>)
        : (opts.createReturn as Record<string, unknown>);
    },
    update: async (_ref, ctx) => {
      if (opts.updateCaptured) opts.updateCaptured.value = (ctx as { input: unknown }).input;
      return opts.updateReturn === undefined
        ? ({ id: "u1", email: "new@b.com" } as Record<string, unknown>)
        : (opts.updateReturn as Record<string, unknown>);
    },
    delete: async () => undefined,
  };

  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [{ field: "id" }, { field: "email" }, { field: "priceCents" }],
      ...(opts.access !== undefined
        ? {
            access: {
              read: opts.access,
              create: opts.access,
              update: opts.access,
              delete: opts.access,
            },
          }
        : {}),
      ...(opts.createDisabled ? { create: { disabled: true } } : {}),
      ...(opts.createFields ? { create: { fields: opts.createFields } } : {}),
      ...(opts.updateDisabled ? { update: { disabled: true } } : {}),
    },
  } as never;

  const config: ResolvedAdminConfig = {
    adapter,
    auth: {
      session: async () => null,
      role: () => opts.role ?? "admin",
    },
    resources: [resource],
    resourcesByName: new Map([["users", resource]]),
    dashboardsByPath: new Map(),
    ...(opts.readOnly ? { readOnly: true } : {}),
    paths: { admin: "/admin", api: "/api/flowpanel" },
    __resolved: true,
  } as never;
  return config;
}

function formRequest(url: string, fields: Record<string, string>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request(url, { method: "POST", body: fd });
}

describe("a money field", () => {
  const fields = [{ name: "email" }, { name: "priceCents", label: "Price", type: "money" }];

  it("stores the typed amount in minor units", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(
      makeConfig({ createCaptured: captured, createFields: fields }),
    );
    const req = formRequest("http://localhost/x", { email: "a@b.com", priceCents: "399.99" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "a@b.com", priceCents: 39999 });
  });

  it("refuses more decimals than the currency keeps, naming the field", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(
      makeConfig({ createCaptured: captured, createFields: fields }),
    );
    const req = formRequest("http://localhost/x", { email: "a@b.com", priceCents: "3.999" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    expect(body.fieldErrors).toEqual({
      priceCents: "Price has more decimals than its currency keeps. Enter an amount like 12.50",
    });
    expect(captured.value).toBeUndefined();
  });

  it("reports a bad amount together with every other field error", async () => {
    const required = [
      { name: "email", label: "Email", required: true },
      { name: "priceCents", label: "Price", type: "money" },
    ];
    const handler = resourceCreateRoute(makeConfig({ createFields: required }));
    const req = formRequest("http://localhost/x", { email: "", priceCents: "12.345" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    expect(body.fieldErrors).toEqual({
      email: "Email is required",
      priceCents: "Price has more decimals than its currency keeps. Enter an amount like 12.50",
    });
  });
});

describe("resourceCreateRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("returns 404 when the resource name is unknown", async () => {
    const handler = resourceCreateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "ghost" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when create is disabled", async () => {
    const handler = resourceCreateRoute(makeConfig({ createDisabled: true }));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/disabled/);
  });

  it("returns 403 when the admin is read-only", async () => {
    const handler = resourceCreateRoute(makeConfig({ readOnly: true }));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when the session's role doesn't satisfy the resource's access", async () => {
    const handler = resourceCreateRoute(makeConfig({ role: "viewer", access: "admin" }));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(403);
  });

  it("creates the row, publishes, and returns its key for entry motion", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(makeConfig({ createCaptured: captured }));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, createdKey: "u1" });
    expect(captured.value).toEqual({ email: "a@b.com" });
    expect(publishResource).toHaveBeenCalledWith("users", { action: "create", id: "u1" });
  });

  it("rejects an oversized form before calling the adapter", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(makeConfig({ createCaptured: captured }));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "content-length": String(1024 * 1024 + 1),
      },
      body: "email=a%40b.com",
    });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });

    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("request body is too large");
    expect(captured.value).toBeUndefined();
  });

  it("coerces an empty form field to null", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(makeConfig({ createCaptured: captured }));
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("priceCents", "");
    const req = new Request("http://localhost/x", { method: "POST", body: fd });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "a@b.com", priceCents: null });
  });

  it("returns fieldErrors + status 422 on a validation failure", async () => {
    const handler = resourceCreateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "not-an-email" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; fieldErrors?: Record<string, string> };
    expect(body.ok).toBe(false);
    expect(body.fieldErrors?.email).toBeDefined();
  });

  // A <form> POST always carries string values, but the inferred create
  // schema (plain drizzle-zod) does not coerce — a numeric column must be
  // converted before it reaches `actions.create`, or every such field fails
  // validation on every submit (see `coerceRowByColumns`).
  it("coerces a numeric form field to a number before validation", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(makeConfig({ createCaptured: captured }));
    const req = formRequest("http://localhost/x", { email: "a@b.com", priceCents: "1999" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "a@b.com", priceCents: 1999 });
  });

  it("returns fieldErrors + status 422 when a numeric field can't be coerced", async () => {
    const handler = resourceCreateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "a@b.com", priceCents: "not-a-number" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; fieldErrors?: Record<string, string> };
    expect(body.ok).toBe(false);
    expect(body.fieldErrors?.priceCents).toBe("Price cents must be a number");
  });

  it("answers 422 'Email is already taken' when the database reports a duplicate", async () => {
    const config = makeConfig({});
    config.adapter.create = async () => {
      throw new Error("Failed query", {
        cause: Object.assign(new Error("duplicate key value violates unique constraint"), {
          code: "23505",
          detail: "Key (email)=(a@b.com) already exists.",
        }),
      });
    };
    const handler = resourceCreateRoute(config);
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      ok: false,
      error: "Validation failed",
      code: "validation_failed",
      requestId: expect.any(String),
      fieldErrors: { email: "Email is already taken" },
    });
  });

  it("returns a generic 500 error (not the raw adapter error) on an unrelated throw", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = makeConfig({});
    config.adapter.create = async () => {
      throw Object.assign(new Error("db exploded"), { safeMessage: "Action failed" });
    };
    const handler = resourceCreateRoute(config);
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Internal server error");
    expect(body.requestId).toEqual(expect.any(String));
    expect(body.error).not.toMatch(/db exploded/);
    expect(log).toHaveBeenCalledWith(
      `[flowpanel] create failed, requestId ${body.requestId}:`,
      expect.objectContaining({ message: "db exploded" }),
    );
    log.mockRestore();
  });
});

describe("resourceUpdateRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("returns 404 when the resource name is unknown", async () => {
    const handler = resourceUpdateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "ghost", id: "u1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when editing is disabled", async () => {
    const handler = resourceUpdateRoute(makeConfig({ updateDisabled: true }));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/disabled/);
  });

  it("returns 403 when the session's role doesn't satisfy the resource's access", async () => {
    const handler = resourceUpdateRoute(makeConfig({ role: "viewer", access: "admin" }));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("updates the row, publishes, and returns { ok: true }", async () => {
    const handler = resourceUpdateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(publishResource).toHaveBeenCalledWith("users", { action: "update", id: "u1" });
  });

  it("returns fieldErrors + status 422 on a validation failure", async () => {
    const handler = resourceUpdateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "not-an-email" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; fieldErrors?: Record<string, string> };
    expect(body.ok).toBe(false);
    expect(body.fieldErrors?.email).toBeDefined();
  });

  it("coerces a numeric form field to a number before validation", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceUpdateRoute(makeConfig({ updateCaptured: captured }));
    const req = formRequest("http://localhost/x", { email: "new@b.com", priceCents: "2500" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "new@b.com", priceCents: 2500 });
  });

  it("answers 422 'Email is required' when an edit empties a NOT NULL column", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceUpdateRoute(makeConfig({ updateCaptured: captured }));
    const req = formRequest("http://localhost/x", { email: "", priceCents: "" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      ok: false,
      error: "Validation failed",
      code: "validation_failed",
      requestId: expect.any(String),
      fieldErrors: { email: "Email is required" },
    });
    expect(captured.value).toBeUndefined();
  });

  it("returns 404 when the adapter reports the row doesn't exist", async () => {
    const handler = resourceUpdateRoute(makeConfig({ updateReturn: null }));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(404);
  });
});

describe("required and read-only fields through the form routes", () => {
  function configWithFields(fields: unknown[], captured?: { value?: unknown }) {
    const config = makeConfig({
      role: "editor",
      ...(captured ? { updateCaptured: captured } : {}),
    });
    const resource = config.resourcesByName.get("users");
    if (!resource) throw new Error("users resource missing");
    Object.assign(resource.options, { create: { fields } });
    return config;
  }
  const requiredPrice = [{ name: "email" }, { name: "priceCents", label: "Price", required: true }];
  const editParams = () => ({ params: Promise.resolve({ resource: "users", id: "u1" }) });

  it("answers 422 with a field error when a create leaves a required field blank", async () => {
    const handler = resourceCreateRoute(configWithFields(requiredPrice));
    const req = formRequest("http://localhost/x", { email: "a@b.com", priceCents: "" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      ok: false,
      fieldErrors: { priceCents: "Price is required" },
    });
  });

  it("answers 422 when an edit clears a required field and 200 when it keeps a value", async () => {
    const handler = resourceUpdateRoute(configWithFields(requiredPrice));
    const cleared = await handler(
      formRequest("http://localhost/x", { email: "a@b.com", priceCents: "" }),
      editParams(),
    );
    expect(cleared.status).toBe(422);
    expect(await cleared.json()).toMatchObject({
      fieldErrors: { priceCents: "Price is required" },
    });
    const kept = await handler(
      formRequest("http://localhost/x", { email: "a@b.com", priceCents: "5" }),
      editParams(),
    );
    expect(kept.status).toBe(200);
  });

  it("saves an edit form that shows a read-only field, without writing that field", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceUpdateRoute(
      configWithFields([{ name: "email" }, { name: "priceCents", readOnly: true }], captured),
    );
    const res = await handler(
      formRequest("http://localhost/x", { email: "c@d.com", priceCents: "3" }),
      editParams(),
    );
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "c@d.com" });
  });

  it("saves an edit form for a role that fieldAccess.write keeps from a shown field", async () => {
    const captured: { value?: unknown } = {};
    const config = configWithFields([{ name: "email" }, { name: "priceCents" }], captured);
    const resource = config.resourcesByName.get("users");
    if (!resource) throw new Error("users resource missing");
    Object.assign(resource.options, { fieldAccess: { priceCents: { write: "admin" } } });
    const res = await resourceUpdateRoute(config)(
      formRequest("http://localhost/x", { email: "c@d.com", priceCents: "" }),
      editParams(),
    );
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "c@d.com" });
  });

  it("still rejects a field fieldAccess.write forbids when it comes from the API", async () => {
    const config = configWithFields([{ name: "email" }, { name: "priceCents" }]);
    const resource = config.resourcesByName.get("users");
    if (!resource) throw new Error("users resource missing");
    Object.assign(resource.options, { fieldAccess: { priceCents: { write: "admin" } } });
    const reqCtx = { role: "editor", session: null, scope: {} } as never;
    await expect(
      makeActions(config, resource, { reqCtx, publish: false }).update("u1", {
        email: "c@d.com",
        priceCents: 3,
      }),
    ).rejects.toThrow('Field "priceCents" cannot be changed.');
  });

  it("saves an edit form for a role that cannot see a role-gated field", async () => {
    const captured: { value?: unknown } = {};
    const config = configWithFields([{ name: "email" }, { name: "priceCents" }], captured);
    Object.assign(config.resourcesByName.get("users")?.options ?? {}, {
      fieldAccess: { priceCents: { read: "admin", write: "admin" } },
    });
    const handler = resourceUpdateRoute(config);
    const res = await handler(
      formRequest("http://localhost/x", { email: "c@d.com" }),
      editParams(),
    );
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "c@d.com" });
  });
});
