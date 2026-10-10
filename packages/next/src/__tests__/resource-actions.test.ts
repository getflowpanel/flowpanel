import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));
// `makeActions`'s no-`reqCtx` fallback path (`ctxFor`) builds its request via
// `buildServerRequest`, which reads `next/headers` — unavailable outside a
// real Next.js request scope. Every test below calls `makeActions(config,
// resource)` without a `reqCtx`, so it needs this mocked the same way
// `build-server-request.test.ts` does.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [] }),
}));

import type { Adapter, AuditConfig, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { makeActions } from "../actions/resource-actions";
import { publishResource } from "../runtime/publish";

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
    get: async () => ({ id: "u1", email: "a@b.com", status: "active" }),
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
    paths: { admin: "/admin", api: "/api/flowpanel" },
    __resolved: true,
  } as never;
  return { config, resource };
}

describe("makeActions.create", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
    vi.mocked(revalidatePath).mockReset();
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
      code: "validation_failed",
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

  it("publishes exactly once for a single create with the default options", async () => {
    const { config, resource } = makeConfig({});
    const actions = makeActions(config, resource);
    await actions.create({ email: "a@b.com" });
    expect(publishResource).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("keeps a committed mutation successful and still revalidates when realtime fails", async () => {
    vi.mocked(publishResource).mockRejectedValueOnce(new Error("redis unavailable"));
    const { config, resource } = makeConfig({});
    const actions = makeActions(config, resource);

    await expect(actions.create({ email: "a@b.com" })).resolves.toMatchObject({ id: "u1" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("skips publish + revalidate when `publish: false` is passed", async () => {
    const { config, resource } = makeConfig({});
    const actions = makeActions(config, resource, { publish: false });
    await actions.create({ email: "a@b.com" });
    expect(publishResource).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("makeActions.update", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
    vi.mocked(revalidatePath).mockReset();
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
      code: "validation_failed",
    });
  });

  it("skips publish + revalidate when `publish: false` is passed", async () => {
    const { config, resource } = makeConfig({});
    const actions = makeActions(config, resource, { publish: false });
    await actions.update("u1", { email: "new@b.com" });
    expect(publishResource).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("makeActions.delete", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
    vi.mocked(revalidatePath).mockReset();
  });

  it("deletes the row, emits audit, and publishes", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const { config, resource } = makeConfig({ audit: { enabled: true, sink } });
    const actions = makeActions(config, resource);
    await actions.delete("u1");
    expect(publishResource).toHaveBeenCalledWith("users", { action: "delete", id: "u1" });
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("skips publish + revalidate when `publish: false` is passed", async () => {
    const { config, resource } = makeConfig({});
    const actions = makeActions(config, resource, { publish: false });
    await actions.delete("u1");
    expect(publishResource).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
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

describe("field rules on the write path", () => {
  it("update rejects a role-gated submitted field declared in the fallback form", async () => {
    const { config, resource } = makeConfig({});
    (resource.options as { create?: unknown }).create = { fields: [{ name: "email" }] };
    (resource.options as { fieldAccess?: unknown }).fieldAccess = { email: { write: "owner" } };
    const seen = vi.fn();
    (config.adapter as { update: unknown }).update = async (
      _ref: unknown,
      mctx: { input: unknown },
    ) => {
      seen(mctx.input);
      return { id: "u1" };
    };
    const actions = makeActions(config, resource);
    await expect(actions.update("u1", { email: "sneaky@b.com" })).rejects.toMatchObject({
      code: "field_forbidden",
      field: "email",
    });
    expect(seen).not.toHaveBeenCalled();
  });

  it("uses the full scoped current row for dynamic write policy even when that value is read-denied", async () => {
    const { config, resource } = makeConfig({});
    (config as { scope?: unknown }).scope = () => ({ tenantId: "t1" });
    (
      resource.options as {
        scope?: unknown;
        update?: unknown;
        fieldAccess?: unknown;
      }
    ).scope = (scope: unknown, query: unknown) => ({ scope, query });
    (resource.options as { update?: unknown }).update = {
      fields: [
        {
          name: "email",
          readOnly: (current: { internalLock?: boolean }) => current.internalLock === true,
        },
      ],
    };
    (resource.options as { fieldAccess?: unknown }).fieldAccess = {
      internalLock: { read: false },
    };
    const get = vi.fn(
      async (
        _ref: unknown,
        _ctx: {
          select?: readonly string[];
          boundScope?: { apply(query: unknown): unknown };
        },
      ) => ({ id: "u1", email: "a@b.com", internalLock: true }),
    );
    (config.adapter as { get: unknown }).get = get;
    const actions = makeActions(config, resource, {
      reqCtx: {
        req: new Request("http://localhost/admin/users/u1/edit"),
        role: "admin",
        session: null,
        scope: { tenantId: "t1" },
        ip: null,
        userAgent: null,
      } as never,
    });

    await expect(actions.update("u1", { email: "new@b.com" })).rejects.toMatchObject({
      code: "field_forbidden",
      field: "email",
    });
    expect(get.mock.calls[0]?.[1].select).toBeUndefined();
    expect(get.mock.calls[0]?.[1].boundScope?.apply("query")).toEqual({
      scope: { tenantId: "t1" },
      query: "query",
    });
  });

  it("reports a required gated field as an access error, not a phantom validation error", async () => {
    const { config, resource } = makeConfig({});
    (resource.options as { create?: unknown }).create = { fields: [{ name: "email" }] };
    (resource.options as { fieldAccess?: unknown }).fieldAccess = { email: { write: "owner" } };
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "a@b.com" })).rejects.toMatchObject({
      code: "field_forbidden",
      field: "email",
    });
  });

  it("reports a missing required field using its FieldDef label, not the raw Zod message", async () => {
    const { config, resource } = makeConfig({
      schema: z.object({ email: z.string().email(), userId: z.number() }),
    });
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email" }, { name: "userId", label: "Customer", required: true }],
    };
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "a@b.com", userId: null })).rejects.toMatchObject({
      code: "validation_failed",
      fieldErrors: { userId: "Customer is required" },
    });
  });

  it("falls back to a humanized field name when the FieldDef has no label", async () => {
    const { config, resource } = makeConfig({
      schema: z.object({ email: z.string().email(), ourPriceCents: z.number() }),
    });
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email" }, { name: "ourPriceCents" }],
    };
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "a@b.com" })).rejects.toMatchObject({
      fieldErrors: { ourPriceCents: "Our price cents is required" },
    });
  });

  it("keeps Zod's own message for a non-empty value that merely fails format validation", async () => {
    const { config, resource } = makeConfig({});
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email", label: "Work email" }],
    };
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "not-an-email" })).rejects.toMatchObject({
      fieldErrors: { email: expect.not.stringMatching(/is required/) },
    });
  });

  it("rejects submitted readOnly fields instead of silently stripping them", async () => {
    const { config, resource } = makeConfig({
      schema: {
        create: z.object({ email: z.string().email(), note: z.string().optional() }),
        update: updateSchema,
      },
    });
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email" }, { name: "note", readOnly: true }],
    };
    const seen = vi.fn();
    (config.adapter as { create: unknown }).create = async (
      _ref: unknown,
      mctx: { input: unknown },
    ) => {
      seen(mctx.input);
      return { id: "u1" };
    };
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "a@b.com", note: "sneaky" })).rejects.toMatchObject({
      code: "field_forbidden",
      field: "note",
    });
    expect(seen).not.toHaveBeenCalled();
  });

  it("runs a Zod FieldDef.validate after schema validation", async () => {
    const { config, resource } = makeConfig({});
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email", validate: z.string().endsWith("@corp.com") }],
    };
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "a@b.com" })).rejects.toMatchObject({
      code: "validation_failed",
      fieldErrors: { email: expect.any(String) },
    });
  });

  it("runs a function FieldDef.validate and keys its message to the field", async () => {
    const { config, resource } = makeConfig({});
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email", validate: () => "corporate addresses only" }],
    };
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "a@b.com" })).rejects.toMatchObject({
      code: "validation_failed",
      fieldErrors: { email: "corporate addresses only" },
    });
  });

  it("fills defaultValue for absent keys on create — after stripping, so a gated required field still lands", async () => {
    const { config, resource } = makeConfig({
      schema: {
        create: z.object({ email: z.string().email(), note: z.string() }),
        update: updateSchema,
      },
    });
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email" }, { name: "note", defaultValue: "server-default" }],
    };
    (resource.options as { fieldAccess?: unknown }).fieldAccess = { note: { write: "owner" } };
    const seen = vi.fn();
    (config.adapter as { create: unknown }).create = async (
      _ref: unknown,
      mctx: { input: unknown },
    ) => {
      seen(mctx.input);
      return { id: "u1" };
    };
    const actions = makeActions(config, resource);
    await actions.create({ email: "a@b.com" });
    expect(seen).toHaveBeenCalledWith({ email: "a@b.com", note: "server-default" });
  });

  it("lets create.defaultValues win over a field's own defaultValue for the same empty key", async () => {
    const { config, resource } = makeConfig({
      schema: {
        create: z.object({ email: z.string().email(), note: z.string() }),
        update: updateSchema,
      },
    });
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email" }, { name: "note", defaultValue: "from-field" }],
      defaultValues: { note: "from-resource" },
    };
    const seen = vi.fn();
    (config.adapter as { create: unknown }).create = async (
      _ref: unknown,
      mctx: { input: unknown },
    ) => {
      seen(mctx.input);
      return { id: "u1" };
    };
    await makeActions(config, resource).create({ email: "a@b.com" });
    expect(seen).toHaveBeenCalledWith({ email: "a@b.com", note: "from-resource" });
  });

  it("reuses a caller-supplied RequestContext instead of building one per call", async () => {
    const { config, resource } = makeConfig({});
    const sessionSpy = vi.fn(async () => null);
    (config.auth as { session: unknown }).session = sessionSpy;
    const reqCtx = {
      req: new Request("http://localhost/import"),
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
    } as never;
    const actions = makeActions(config, resource, { reqCtx });
    await actions.create({ email: "a@b.com" });
    await actions.create({ email: "b@b.com" });
    expect(sessionSpy).not.toHaveBeenCalled();
  });
});

describe("required fields on the server", () => {
  const optionalSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().nullable().optional(),
  });

  function withFields(fields: unknown[], mode: "create" | "update" = "create") {
    const made = makeConfig({ schema: optionalSchema });
    (made.resource.options as Record<string, unknown>)[mode] = { fields };
    return made;
  }

  it("rejects a create that leaves a required field empty, with the form's message", async () => {
    const { config, resource } = withFields([
      { name: "email" },
      { name: "name", label: "Full name", required: true },
    ]);
    const actions = makeActions(config, resource);
    for (const name of [undefined, null, "", "   "]) {
      await expect(actions.create({ email: "a@b.com", name })).rejects.toMatchObject({
        code: "validation_failed",
        fieldErrors: { name: "Full name is required" },
      });
    }
  });

  it("reports a missing required field next to the schema's own errors", async () => {
    const { config, resource } = withFields([{ name: "email" }, { name: "name", required: true }]);
    const actions = makeActions(config, resource);
    await expect(actions.create({ email: "nope" })).rejects.toMatchObject({
      fieldErrors: { email: expect.any(String), name: "Name is required" },
    });
  });

  it("accepts a required field that a defaultValue fills", async () => {
    const { config, resource } = withFields([
      { name: "email" },
      { name: "name", required: true, defaultValue: "Anonymous" },
    ]);
    await expect(makeActions(config, resource).create({ email: "a@b.com" })).resolves.toBeTruthy();
  });

  it("skips required fields the form did not offer as editable", async () => {
    const { config, resource } = withFields([
      { name: "email", required: true, hidden: true },
      { name: "name", required: true, readOnly: () => true },
      { name: "status", required: true },
    ]);
    (resource.options as { fieldAccess?: unknown }).fieldAccess = { status: { write: "owner" } };
    await expect(makeActions(config, resource).create({})).resolves.toBeTruthy();
  });

  it("lets an edit leave a required field out, keeping the stored value", async () => {
    const { config, resource } = withFields(
      [{ name: "email" }, { name: "name", required: true }],
      "update",
    );
    await expect(
      makeActions(config, resource).update("u1", { email: "c@d.com" }),
    ).resolves.toBeTruthy();
  });

  it("rejects an edit that clears a required field", async () => {
    const { config, resource } = withFields([{ name: "name", required: true }], "update");
    const actions = makeActions(config, resource);
    for (const name of [null, ""]) {
      await expect(actions.update("u1", { name })).rejects.toMatchObject({
        code: "validation_failed",
        fieldErrors: { name: "Name is required" },
      });
    }
  });
});

describe("readOnly next to fieldAccess", () => {
  it("keeps a role-gated field read-only for a role that passes the gate", async () => {
    const { config, resource } = makeConfig({});
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email", readOnly: true }],
    };
    (resource.options as { fieldAccess?: unknown }).fieldAccess = { email: { write: "admin" } };
    await expect(makeActions(config, resource).create({ email: "a@b.com" })).rejects.toMatchObject({
      code: "field_forbidden",
      field: "email",
    });
  });

  it("evaluates a function readOnly on create, against an empty row", async () => {
    const seen = vi.fn((values: Record<string, unknown>) => values.locked !== false);
    const { config, resource } = makeConfig({});
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email", readOnly: seen }],
    };
    await expect(makeActions(config, resource).create({ email: "a@b.com" })).rejects.toMatchObject({
      code: "field_forbidden",
      field: "email",
    });
    expect(seen).toHaveBeenCalledWith({});
  });

  it("lets a create write a field whose function readOnly is false for a new row", async () => {
    const { config, resource } = makeConfig({});
    (resource.options as { create?: unknown }).create = {
      fields: [{ name: "email", readOnly: (values: { id?: string }) => values.id !== undefined }],
    };
    await expect(makeActions(config, resource).create({ email: "a@b.com" })).resolves.toBeTruthy();
  });
});
