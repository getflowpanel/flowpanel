import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, AuditConfig, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { z } from "zod";
import { makeActions, makeFormAction } from "../actions/resource-actions.js";
import { publishResource } from "../runtime/publish.js";

const createSchema = z.object({ email: z.string().email() });
const updateSchema = z.object({ email: z.string().email().optional() });

function makeConfig(opts: {
  audit?: AuditConfig | undefined;
  resourceAudit?: boolean;
  schema?: unknown;
  inferReturn?: { create: unknown; update: unknown };
  createReturn?: Record<string, unknown> | null;
  updateReturn?: Record<string, unknown> | null;
  softDelete?: boolean | string;
  session?: unknown;
}) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () =>
      (opts.inferReturn ?? {
        create: createSchema,
        update: updateSchema,
      }) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => null,
    create: async () =>
      opts.createReturn === undefined
        ? ({ id: "u1", email: "a@b.com" } as Record<string, unknown>)
        : (opts.createReturn as Record<string, unknown>),
    update: async () =>
      opts.updateReturn === undefined
        ? ({ id: "u1", email: "new@b.com" } as Record<string, unknown>)
        : (opts.updateReturn as Record<string, unknown>),
    delete: async () => undefined,
  };

  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [{ field: "id" }, { field: "email" }],
      ...(opts.schema !== undefined ? { schema: opts.schema as never } : {}),
      ...(opts.resourceAudit === false ? { audit: false } : {}),
      ...(opts.softDelete !== undefined
        ? { delete: { softDelete: opts.softDelete } as never }
        : {}),
    },
  } as never;

  const config: ResolvedAdminConfig = {
    adapter,
    auth: {
      session: async () => (opts.session === undefined ? null : opts.session),
      role: () => "admin",
    },
    ...(opts.audit ? { audit: opts.audit } : {}),
    resources: [resource],
    resourcesByName: new Map([["users", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return { config, resource };
}

describe("makeActions.create", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("creates the row, emits audit with target id, and publishes", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const { config, resource } = makeConfig({
      audit: { enabled: true, sink },
      session: { user: { id: "actor-1" } },
    });
    const actions = makeActions(config, resource);
    const row = (await actions.create({ email: "a@b.com" })) as {
      id: string;
    };
    expect(row.id).toBe("u1");
    expect(publishResource).toHaveBeenCalledWith("users", {
      action: "create",
      id: "u1",
    });
    expect(sink).toHaveBeenCalledTimes(1);
    const ev = sink.mock.calls[0]?.[0] as { action: string; targetId?: string; actorId: string };
    expect(ev.action).toBe("users.create");
    expect(ev.targetId).toBe("u1");
    expect(ev.actorId).toBe("actor-1");
  });

  it("throws FlowpanelValidationError with fieldErrors on bad input", async () => {
    const { config, resource } = makeConfig({});
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "not-email" })).rejects.toMatchObject({
      code: "validation",
      fieldErrors: expect.objectContaining({ email: expect.any(String) }),
    });
  });

  it("omits targetId when adapter.create returns row without id", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const { config, resource } = makeConfig({
      audit: { enabled: true, sink },
      createReturn: { email: "a@b.com" } as Record<string, unknown>,
    });
    const actions = makeActions(config, resource);
    await actions.create({ email: "a@b.com" });
    const ev = sink.mock.calls[0]?.[0] as { targetId?: string };
    expect(ev.targetId).toBeUndefined();
  });

  it("omits targetId when adapter.create returns null", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const { config, resource } = makeConfig({
      audit: { enabled: true, sink },
      createReturn: null,
    });
    const actions = makeActions(config, resource);
    await actions.create({ email: "a@b.com" });
    expect(publishResource).toHaveBeenCalledWith("users", { action: "create" });
  });
});

describe("makeActions.update", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("updates the row, emits audit with targetId, and publishes", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const { config, resource } = makeConfig({ audit: { enabled: true, sink } });
    const actions = makeActions(config, resource);
    const row = (await actions.update("u1", { email: "new@b.com" })) as { id: string };
    expect(row.id).toBe("u1");
    expect(publishResource).toHaveBeenCalledWith("users", { action: "update", id: "u1" });
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("throws FlowpanelNotFoundError when adapter.update returns null", async () => {
    const { config, resource } = makeConfig({ updateReturn: null });
    const actions = makeActions(config, resource);
    await expect(actions.update("u1", { email: "new@b.com" })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("throws FlowpanelValidationError on bad input", async () => {
    const { config, resource } = makeConfig({});
    const actions = makeActions(config, resource);
    await expect(actions.update("u1", { email: "broken" })).rejects.toMatchObject({
      code: "validation",
    });
  });
});

describe("makeActions.delete", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("deletes the row, emits audit, and publishes", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const { config, resource } = makeConfig({ audit: { enabled: true, sink } });
    const actions = makeActions(config, resource);
    await actions.delete("u1");
    expect(publishResource).toHaveBeenCalledWith("users", { action: "delete", id: "u1" });
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("threads softDelete column through to adapter.delete", async () => {
    const { config, resource } = makeConfig({ softDelete: "deletedAt" });
    let captured: unknown = null;
    config.adapter.delete = async (_ref, ctx) => {
      captured = (ctx as { softDelete?: unknown }).softDelete;
    };
    const actions = makeActions(config, resource);
    await actions.delete("u1");
    expect(captured).toEqual({ column: "deletedAt" });
  });
});

describe("makeActions — schemasFor", () => {
  it("uses user-supplied { create, update } pair when present, fills missing from adapter", async () => {
    const tightCreate = z.object({ email: z.string().email().min(5) });
    const { config, resource } = makeConfig({
      schema: { create: tightCreate }, // only `create` provided — `update` should fall back
    });
    const actions = makeActions(config, resource);
    // 'a@b.co' is 6 chars and passes the .min(5) check; falls below tightCreate's min if we set tightCreate.min(10), but here we just verify schemas wire up.
    await expect(actions.create({ email: "ok@b.com" })).resolves.toBeDefined();
    // Update uses fallback (adapter.inferSchema().update) — passing an email through it should succeed.
    await expect(actions.update("u1", { email: "new@b.com" })).resolves.toBeDefined();
  });

  it("uses a single Zod schema for both create and update when user-supplied schema is not a pair", async () => {
    const single = z.object({ email: z.string().email() });
    const { config, resource } = makeConfig({ schema: single });
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "z@b.com" })).resolves.toBeDefined();
  });
});

describe("actorIdFromSession (via audit event)", () => {
  it("stringifies non-string user.id (e.g. number)", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const { config, resource } = makeConfig({
      audit: { enabled: true, sink },
      session: { user: { id: 42 } },
    });
    const actions = makeActions(config, resource);
    await actions.create({ email: "a@b.com" });
    const ev = sink.mock.calls[0]?.[0] as { actorId: string | null };
    expect(ev.actorId).toBe("42");
  });

  it("returns null for non-object session", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const { config, resource } = makeConfig({
      audit: { enabled: true, sink },
      session: "nope" as never,
    });
    const actions = makeActions(config, resource);
    await actions.create({ email: "a@b.com" });
    const ev = sink.mock.calls[0]?.[0] as { actorId: string | null };
    expect(ev.actorId).toBeNull();
  });
});

describe("makeFormAction", () => {
  it("returns { ok: true } on a successful create", async () => {
    const { config, resource } = makeConfig({});
    const action = makeFormAction(config, resource, "create");
    const fd = new FormData();
    fd.set("email", "a@b.com");
    const result = await action(null, fd);
    expect(result).toEqual({ ok: true });
  });

  it("maps a FlowpanelValidationError to { ok: false, fieldErrors }", async () => {
    const { config, resource } = makeConfig({});
    const action = makeFormAction(config, resource, "create");
    const fd = new FormData();
    fd.set("email", "not-email");
    const result = await action(null, fd);
    expect(result.ok).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(result.fieldErrors?.email).toBeDefined();
  });

  it("returns { ok: false, error } on a non-validation error", async () => {
    const { config, resource } = makeConfig({});
    // Force the underlying adapter call to throw an unrelated error.
    config.adapter.create = async () => {
      const e = Object.assign(new Error("boom"), { safeMessage: "Action failed" });
      throw e;
    };
    const action = makeFormAction(config, resource, "create");
    const fd = new FormData();
    fd.set("email", "a@b.com");
    const result = await action(null, fd);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Action failed");
  });

  it("coerces empty form-data values to null before submitting", async () => {
    let received: unknown = null;
    const { config, resource } = makeConfig({
      schema: z.object({ email: z.string().email(), nickname: z.null() }),
    });
    config.adapter.create = async (_ref, ctx) => {
      received = (ctx as { input: unknown }).input;
      return { id: "u1" };
    };
    const action = makeFormAction(config, resource, "create");
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("nickname", "");
    const result = await action(null, fd);
    expect(result.ok).toBe(true);
    expect(received).toEqual({ email: "a@b.com", nickname: null });
  });

  it("runs the update path when kind='update' and id provided", async () => {
    const { config, resource } = makeConfig({});
    const action = makeFormAction(config, resource, "update", "u1");
    const fd = new FormData();
    fd.set("email", "x@b.com");
    const result = await action(null, fd);
    expect(result.ok).toBe(true);
  });

  it("returns { ok: true } early if kind='update' and id missing (no-op)", async () => {
    const { config, resource } = makeConfig({});
    const action = makeFormAction(config, resource, "update");
    const result = await action(null, new FormData());
    expect(result.ok).toBe(true);
  });
});
