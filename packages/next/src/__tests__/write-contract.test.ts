import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(async () => {}),
  publishResource: vi.fn(async () => {}),
  bindPublisher: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import {
  type AuditEvent,
  DEFAULT_LABELS,
  dashboard,
  defineAdmin,
  type ErrorContext,
  resource,
} from "@flowpanel/core";
import Database from "better-sqlite3";
import { eq, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { handlers } from "../handlers";
import { resolveResourceListActions } from "../pages/resource-list-actions";
import { buildResourceListCreateAction } from "../pages/resource-list-create-action";
import { listEmptyProps } from "../pages/resource-list-empty";
import { offeredDashboardActions } from "../runtime/action-gate";
import { auditReadFilter } from "../runtime/audit-view";
import { publish, publishResource } from "../runtime/publish";
import { recordActions } from "../runtime/record-actions";
import { buildRequestContext } from "../runtime/request-setup";

const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tenantId: text("tenant_id").notNull(),
});

const orders = sqliteTable("orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull(),
  status: text("status"),
  note: text("note"),
  internalNote: text("internal_note"),
  code: text("code"),
  customerId: text("customer_id"),
  token: text("token"),
  tenantId: text("tenant_id").notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

const TEMPLATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../cli/src/templates/migration.sqlite.sql.txt",
);

const sqlite = new Database(":memory:");
const db = drizzle(sqlite);
afterAll(() => sqlite.close());

type Actor = {
  userId: string;
  role: string;
  tenantId: string;
};
const ADMIN: Actor = { userId: "u-admin", role: "admin", tenantId: "A" };
const SUPPORT: Actor = { userId: "u-support", role: "support", tenantId: "A" };
const VIEWER: Actor = { userId: "u-viewer", role: "viewer", tenantId: "A" };
let actor: Actor | null = ADMIN;

const audited: AuditEvent[] = [];
const errors: ErrorContext[] = [];

function sqlRun(statement: string, ...params: unknown[]): void {
  sqlite.prepare(statement).run(...params);
}

const tenantOf = (scope: unknown) => (scope as { tenantId: string }).tenantId;

type Variant = "default" | "readOnly" | "createDisabled" | "updateDisabled" | "deleteDisabled";

const planForm = [{ name: "plan", type: "select" as const, options: ["free", "pro"] }];

function buildAdmin(variant: Variant) {
  return defineAdmin({
    adapter: drizzleAdapter({ db, schema: { customers, orders }, dialect: "sqlite" }),
    auth: {
      session: async () => actor,
      role: (session) => (session as Actor | null)?.role ?? "anonymous",
      access: ({ session }) => session !== null,
      userId: (session) => (session as Actor | null)?.userId ?? null,
    },
    scope: async ({ session }) => ({ tenantId: (session as Actor | null)?.tenantId ?? "none" }),
    audit: {
      sink: async (event: AuditEvent) => {
        audited.push(event);
      },
    },
    hooks: {
      onError: async (_error, context) => {
        errors.push(context);
      },
    },
    ...(variant === "readOnly" ? { readOnly: true } : {}),
    resources: [
      resource(customers, {
        columns: ["name"],
        search: ["name"],
        scope: (scope, query: { where(condition: SQL): unknown }) =>
          query.where(eq(customers.tenantId, tenantOf(scope))),
      }),
      resource(orders, {
        columns: [
          { field: "number", editable: true },
          { field: "status", editable: true },
          { field: "note", editable: true },
          { field: "internalNote", editable: true },
          { field: "code", editable: true },
          { field: "tenantId", editable: true },
          { field: "customerId", editable: true },
        ],
        scope: (scope, query: { where(condition: SQL): unknown }) =>
          query.where(eq(orders.tenantId, tenantOf(scope))),
        access: {
          read: ["admin", "support", "viewer"],
          create: ["admin", "support"],
          update: ["admin", "support"],
          delete: ["admin", "support"],
        },
        fieldAccess: { internalNote: { write: "admin" }, token: { sensitive: true } },
        create: {
          ...(variant === "createDisabled" ? { disabled: true } : {}),
          fields: [
            { name: "number", required: true },
            {
              name: "status",
              type: "select",
              options: async (ctx) =>
                (ctx.role === "admin" ? ["open", "shipped", "archived"] : ["open", "shipped"]).map(
                  (value) => ({ label: value, value }),
                ),
            },
            {
              name: "note",
              validate: (value) => (value === "bad" ? "Notes cannot say bad." : null),
            },
            { name: "internalNote" },
            { name: "code", readOnly: true },
            { name: "customerId", reference: { resource: "customers", labelField: "name" } },
            {
              name: "tenantId",
              type: "hidden",
              hidden: true,
              defaultValue: async (ctx: { session: unknown }) => (ctx.session as Actor).tenantId,
            },
          ],
        },
        ...(variant === "updateDisabled" ? { update: { disabled: true } } : {}),
        delete: {
          softDelete: "deletedAt",
          ...(variant === "deleteDisabled" ? { disabled: true } : {}),
        },
        import: { formats: ["json"] },
        export: { formats: ["csv"] },
        actions: [
          {
            key: "explode",
            label: "Explode",
            run: async () => {
              throw new Error("boom");
            },
          },
          {
            key: "resend",
            label: "Resend",
            run: async () => ({ ok: true }),
          },
          {
            key: "reopen",
            label: "Reopen",
            access: ["admin", "support"],
            when: ({ current }) => current?.status === "shipped",
            run: async () => ({ ok: true }),
          },
          {
            key: "ship",
            label: "Ship",
            access: "admin",
            form: planForm,
            run: async (row) => {
              sqlRun(
                "UPDATE orders SET status = 'shipped', token = 'rotated' WHERE id = ?",
                row.id,
              );
              return { ok: true, refresh: true };
            },
          },
        ],
        bulkActions: [
          { key: "tag", label: "Tag", run: async () => ({ ok: true }) },
          {
            key: "archive",
            label: "Archive",
            access: "admin",
            form: planForm,
            run: async (ids) => {
              for (const id of ids)
                sqlRun("UPDATE orders SET status = 'archived' WHERE id = ?", id);
              return { ok: true, refresh: true };
            },
          },
        ],
        drawer: {
          fields: "*",
          actions: [
            {
              key: "flag",
              label: "Flag",
              form: planForm,
              run: async (row) => {
                sqlRun("UPDATE orders SET note = 'flagged' WHERE id = ?", row.id);
                return { ok: true, refresh: true };
              },
            },
          ],
        },
      }),
    ],
    dashboards: [
      dashboard({
        path: "/",
        label: "Overview",
        sections: [],
        access: ["admin", "support"],
        actions: [
          {
            key: "reset",
            label: "Reset",
            access: "admin",
            form: planForm,
            run: async () => {
              sqlRun("UPDATE orders SET note = 'reset' WHERE tenant_id = 'A'");
              return { ok: true, refresh: "pipeline" };
            },
          },
        ],
      }),
    ],
  });
}

const admins = new Map<Variant, ReturnType<typeof buildAdmin>>();
function admin(variant: Variant) {
  let built = admins.get(variant);
  if (!built) {
    built = buildAdmin(variant);
    admins.set(variant, built);
  }
  return built;
}

function resetTables(): void {
  sqlite.exec("DROP TABLE IF EXISTS orders; DROP TABLE IF EXISTS customers;");
  sqlite.exec("CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, tenant_id TEXT)");
  sqlite.exec(
    "CREATE TABLE orders (id TEXT PRIMARY KEY, number TEXT NOT NULL, status TEXT, note TEXT, " +
      "internal_note TEXT, code TEXT, customer_id TEXT, token TEXT, tenant_id TEXT NOT NULL, " +
      "deleted_at INTEGER)",
  );
  sqlite.exec("INSERT INTO customers VALUES ('c-a', 'Ann', 'A'), ('c-b', 'Bob', 'B')");
  sqlite.exec(
    "INSERT INTO orders VALUES " +
      "('o-a', 'A-1', 'open', NULL, NULL, 'X1', 'c-a', 't1', 'A', NULL), " +
      "('o-b', 'B-1', 'open', NULL, NULL, 'X2', 'c-b', 't2', 'B', NULL)",
  );
}

beforeEach(() => {
  resetTables();
  audited.length = 0;
  errors.length = 0;
  vi.mocked(publish).mockClear();
  vi.mocked(publishResource).mockClear();
  actor = ADMIN;
});

function snapshot(): unknown[] {
  return sqlite.prepare("SELECT * FROM orders ORDER BY id").all();
}

interface Call {
  id: string;
  values: Record<string, unknown>;
  /** The one field an inline edit changes. */
  field: string;
  /** An action's own input. */
  input: Record<string, unknown>;
  origin: string;
}

type Send = (h: ReturnType<typeof handlers>, call: Call) => Promise<Response>;

function route(...segments: string[]) {
  return { params: Promise.resolve({ route: segments }) };
}

function request(call: Call, method: string, body?: BodyInit, type?: string): Request {
  return new Request("http://localhost/api/flowpanel/x", {
    method,
    headers: { origin: call.origin, ...(type ? { "content-type": type } : {}) },
    ...(body === undefined ? {} : { body }),
  });
}

function json(call: Call, method: string, body: unknown): Request {
  return request(call, method, JSON.stringify(body), "application/json");
}

function form(call: Call): Request {
  const data = new FormData();
  for (const [key, value] of Object.entries(call.values)) data.set(key, String(value ?? ""));
  return request(call, "POST", data);
}

const ENTRY_POINTS = {
  formCreate: (h, c) => h.POST(form(c), route("orders", "create")),
  formUpdate: (h, c) => h.POST(form(c), route("orders", c.id, "edit")),
  jsonCreate: (h, c) => h.POST(json(c, "POST", c.values), route("orders")),
  jsonUpdate: (h, c) => h.PATCH(json(c, "PATCH", c.values), route("orders", c.id)),
  jsonDelete: (h, c) => h.DELETE(request(c, "DELETE"), route("orders", c.id)),
  rowAction: (h, c) => h.POST(json(c, "POST", c.input), route("orders", c.id, "actions", "ship")),
  bulkAction: (h, c) =>
    h.POST(
      json(c, "POST", { ids: [c.id], input: c.input }),
      route("orders", "bulk-actions", "archive"),
    ),
  bulkDelete: (h, c) =>
    h.POST(json(c, "POST", { ids: [c.id] }), route("orders", "bulk-actions", "delete")),
  inline: (h, c) =>
    h.POST(
      json(c, "POST", { field: c.field, value: c.values[c.field] }),
      route("orders", c.id, "update"),
    ),
  restore: (h, c) => h.POST(request(c, "POST"), route("orders", c.id, "restore")),
  drawerAction: (h, c) =>
    h.POST(json(c, "POST", c.input), route("drawer", "orders", c.id, "actions", "flag")),
  dashboardAction: (h, c) =>
    h.POST(json(c, "POST", c.input), route("dashboards", "_root_", "actions", "reset")),
  import: (h, c) =>
    h.POST(
      json(c, "POST", { format: "json", content: JSON.stringify([c.values]) }),
      route("orders", "import"),
    ),
  export: (h, c) =>
    h.GET(
      new Request("http://localhost/api/flowpanel/export/orders?format=csv", {
        headers: { origin: c.origin },
      }),
      route("export", "orders"),
    ),
} satisfies Record<string, Send>;

type EntryPoint = keyof typeof ENTRY_POINTS;
const COLUMNS = Object.keys(ENTRY_POINTS) as EntryPoint[];

/**
 * - a status: refused with it, nothing written, nothing audited or published.
 * - `STRIP`: a posted form drops the value (it also carries the read-only fields it showed); the rest saves.
 * - `ROW`: an import reports the row as failed and writes nothing.
 * - `OK`: saved, audited with the real actor, published.
 * - `NA`: the case does not apply to this entry point.
 */
const STRIP = "strip";
const ROW = "row failed";
const OK = "ok";
const NA = null;
type Outcome = 403 | 404 | 422 | typeof STRIP | typeof ROW | typeof OK | typeof NA;

interface Case {
  actor?: Actor | null;
  variant?: Variant;
  id?: string;
  values?: Record<string, unknown>;
  origin?: string;
  /** An action's own input. */
  input?: Record<string, unknown>;
  /** For `STRIP`: the stored column that must not take the submitted value. */
  guarded?: string;
  /** Whether the row is soft-deleted; Restore's row is unless the case says otherwise. */
  deleted?: boolean;
}

const CASES: Record<string, Case> = {
  "allowed write": {},
  "signed out": { actor: null },
  "resource access denies the role": { actor: VIEWER },
  "action access denies the role": { actor: SUPPORT },
  "fieldAccess.write denies the field": {
    actor: SUPPORT,
    values: { internalNote: "hi" },
    guarded: "internal_note",
  },
  "field is readOnly": { values: { code: "Z9" }, guarded: "code" },
  "admin is readOnly": { variant: "readOnly" },
  "create is disabled": { variant: "createDisabled" },
  "update is disabled": { variant: "updateDisabled" },
  "delete is disabled": { variant: "deleteDisabled" },
  "Origin is another site": { origin: "https://evil.example" },
  "row belongs to another tenant": { id: "o-b" },
  "write moves the row to another tenant": { values: { tenantId: "B" }, guarded: "tenant_id" },
  "select value is not offered to the role": { actor: SUPPORT, values: { status: "archived" } },
  "reference points at another tenant's row": { values: { customerId: "c-b" } },
  "field validator rejects the value": { values: { note: "bad" } },
  "required field is emptied": { values: { number: "" } },
  "action choice is not offered": { input: { plan: "enterprise" } },
  "row is soft-deleted": { deleted: true },
  "row is not deleted": { deleted: false },
};

// biome-ignore format: the contract reads as a table
const EXPECTED: Record<keyof typeof CASES, Outcome[]> = {
  //                                           formCreate formUpdate jsonCreate jsonUpdate jsonDelete rowAction bulkAction bulkDelete inline restore drawerAction dashboardAction import export
  "allowed write":                              [OK,        OK,        OK,        OK,        OK,        OK,       OK,        OK,        OK,    OK,     OK,          OK,             OK,    OK],
  "signed out":                                 [403,       403,       403,       403,       403,       403,      403,       403,       403,   403,    403,         403,            403,   403],
  "resource access denies the role":            [403,       403,       403,       403,       403,       403,      403,       403,       403,   403,    403,         403,            403,   OK],
  "action access denies the role":              [NA,        NA,        NA,        NA,        NA,        403,      403,       NA,        NA,    NA,     NA,          403,            NA,    NA],
  "fieldAccess.write denies the field":         [STRIP,     STRIP,     403,       403,       NA,        NA,       NA,        NA,        403,   NA,     NA,          NA,             ROW,   NA],
  "field is readOnly":                          [STRIP,     STRIP,     403,       403,       NA,        NA,       NA,        NA,        403,   NA,     NA,          NA,             ROW,   NA],
  "admin is readOnly":                          [403,       403,       403,       403,       403,       403,      403,       403,       403,   403,    403,         403,            403,   OK],
  "create is disabled":                         [403,       NA,        403,       NA,        NA,        NA,       NA,        NA,        NA,    NA,     NA,          NA,             403,   NA],
  "update is disabled":                         [NA,        403,       NA,        403,       NA,        NA,       NA,        NA,        403,   403,    NA,          NA,             NA,    NA],
  "delete is disabled":                         [NA,        NA,        NA,        NA,        403,       NA,       NA,        404,       NA,    NA,     NA,          NA,             NA,    NA],
  "Origin is another site":                     [403,       403,       403,       403,       403,       403,      403,       403,       403,   403,    403,         403,            403,   NA],
  "row belongs to another tenant":              [NA,        404,       NA,        404,       404,       404,      404,       404,       404,   404,    404,         NA,             NA,    NA],
  "write moves the row to another tenant":      [STRIP,     STRIP,     403,       403,       NA,        NA,       NA,        NA,        403,   NA,     NA,          NA,             ROW,   NA],
  "select value is not offered to the role":    [422,       422,       422,       422,       NA,        NA,       NA,        NA,        422,   NA,     NA,          NA,             ROW,   NA],
  "reference points at another tenant's row":   [422,       422,       422,       422,       NA,        NA,       NA,        NA,        422,   NA,     NA,          NA,             ROW,   NA],
  "field validator rejects the value":          [422,       422,       422,       422,       NA,        NA,       NA,        NA,        422,   NA,     NA,          NA,             ROW,   NA],
  "required field is emptied":                  [422,       422,       422,       422,       NA,        NA,       NA,        NA,        422,   NA,     NA,          NA,             ROW,   NA],
  "action choice is not offered":               [NA,        NA,        NA,        NA,        NA,        422,      422,       NA,        NA,    NA,     422,         422,            NA,    NA],
  "row is soft-deleted":                        [NA,        404,       NA,        404,       404,       404,      404,       404,       404,   OK,     404,         NA,             NA,    NA],
  "row is not deleted":                         [NA,        NA,        NA,        NA,        NA,        NA,       NA,        NA,        NA,    404,    NA,          NA,             NA,    NA],
};

const BASE_VALUES = { number: "A-9", status: "shipped" };

async function run(
  name: keyof typeof CASES,
  entry: EntryPoint,
): Promise<{ res: Response; before: unknown[] }> {
  const spec = CASES[name] ?? {};
  actor = spec.actor === undefined ? ADMIN : spec.actor;
  const id = spec.id ?? "o-a";
  if (spec.deleted ?? entry === "restore") {
    sqlRun("UPDATE orders SET deleted_at = 1700000000 WHERE id = ?", id);
  }
  const before = snapshot();
  const call: Call = {
    id,
    values: { ...BASE_VALUES, ...spec.values },
    field: Object.keys(spec.values ?? {})[0] ?? "status",
    input: spec.input ?? {},
    origin: spec.origin ?? "http://localhost",
  };
  const res = await ENTRY_POINTS[entry](handlers(admin(spec.variant ?? "default")), call);
  return { res, before };
}

function expectNothingHappened(before: unknown[]): void {
  expect(snapshot()).toEqual(before);
  expect(audited).toEqual([]);
  expect(publishResource).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
}

function expectAuditedAndPublished(entry: EntryPoint): void {
  expect(audited.length).toBeGreaterThan(0);
  for (const event of audited) expect(event.actorId).toBe(actor?.userId);
  if (entry === "export") {
    expect(audited.map((event) => event.action)).toEqual(["orders.export"]);
    expect(publishResource).not.toHaveBeenCalled();
    return;
  }
  if (entry === "dashboardAction") expect(publish).toHaveBeenCalledWith("pipeline");
  else expect(publishResource).toHaveBeenCalledWith("orders", expect.anything());
}

describe("every write entry point honours the same contract", () => {
  for (const [name, outcomes] of Object.entries(EXPECTED)) {
    describe(name, () => {
      COLUMNS.forEach((entry, index) => {
        const outcome = outcomes[index] ?? NA;
        if (outcome === NA) return;
        it(`${entry}: ${outcome}`, async () => {
          const { res, before } = await run(name, entry);
          const body = await res.clone().text();
          if (typeof outcome === "number") {
            expect(res.status, body).toBe(outcome);
            expectNothingHappened(before);
            return;
          }
          if (outcome === ROW) {
            expect(res.status, body).toBe(200);
            const parsed = JSON.parse(body) as { imported: number; failed: unknown[] };
            expect(parsed.imported, body).toBe(0);
            expect(parsed.failed).toHaveLength(1);
            expect(snapshot()).toEqual(before);
            return;
          }
          expect(res.status, body).toBe(200);
          if (outcome === STRIP) {
            const spec = CASES[name];
            const submitted = Object.values(spec?.values ?? {})[0];
            const stored = sqlite
              .prepare(`SELECT ${spec?.guarded} AS value FROM orders WHERE number = 'A-9'`)
              .all() as { value: unknown }[];
            expect(stored).toHaveLength(1);
            for (const row of stored) expect(row.value).not.toBe(submitted);
          }
          expectAuditedAndPublished(entry);
        });
      });
    });
  }
});

describe("choices and references the row already holds", () => {
  it("refuses a filter sentinel as a reference id", async () => {
    const res = await ENTRY_POINTS.jsonUpdate(handlers(admin("default")), {
      id: "o-a",
      values: { customerId: "__notnull__" },
      field: "customerId",
      input: {},
      origin: "http://localhost",
    });
    expect(res.status).toBe(422);
  });

  it("keeps a status the role can no longer pick when the edit leaves it unchanged", async () => {
    sqlRun("UPDATE orders SET status = 'archived' WHERE id = 'o-a'");
    actor = SUPPORT;
    const res = await ENTRY_POINTS.jsonUpdate(handlers(admin("default")), {
      id: "o-a",
      values: { number: "A-2", status: "archived" },
      field: "number",
      input: {},
      origin: "http://localhost",
    });
    expect(res.status, await res.clone().text()).toBe(200);
  });
});

describe("what the write path reveals", () => {
  const call = { id: "o-a", values: {}, field: "status", input: {}, origin: "http://localhost" };

  it("answers a signed-out caller the same for names that exist and names that do not", async () => {
    actor = null;
    const h = handlers(admin("default"));
    const known = await ENTRY_POINTS.rowAction(h, call);
    const statuses = await Promise.all([
      h.POST(json(call, "POST", {}), route("orders", "o-a", "actions", "nope")),
      h.POST(json(call, "POST", {}), route("ghosts", "o-a", "actions", "ship")),
      h.POST(json(call, "POST", {}), route("ghosts", "import")),
      h.POST(json(call, "POST", {}), route("ghosts")),
      h.GET(request(call, "GET"), route("ghosts")),
      h.GET(request(call, "GET"), route("drawer", "ghosts", "o-a")),
    ]);
    expect(statuses.map((res) => res.status)).toEqual(statuses.map(() => known.status));
  });

  it("keeps sensitive columns out of a row action's audit diff", async () => {
    const res = await ENTRY_POINTS.rowAction(handlers(admin("default")), call);
    expect(res.status).toBe(200);
    expect(audited[0]?.diff).toEqual({ before: { status: "open" }, after: { status: "shipped" } });
  });

  it("names the configured actor when an action fails", async () => {
    const res = await handlers(admin("default")).POST(
      json(call, "POST", {}),
      route("orders", "o-a", "actions", "explode"),
    );
    expect(res.status).toBe(500);
    expect(errors.map((context) => context.actorId)).toEqual(["u-admin"]);
  });
});

describe("every audited write shows to the readers who may see it", () => {
  const auditDb = new Database(":memory:");
  const probe = sqliteTable("probe", { id: text("id").primaryKey() });
  const auditAdapter = drizzleAdapter({
    db: drizzle(auditDb),
    schema: { probe },
    dialect: "sqlite",
  });
  const GUEST: Actor = { userId: "u-guest", role: "guest", tenantId: "A" };
  afterAll(() => auditDb.close());

  async function seenBy(reader: Actor): Promise<number> {
    const log = auditAdapter.auditLog;
    if (!log) throw new Error("the adapter has no audit log");
    const reqCtx = {
      req: new Request("http://localhost/admin/audit-log"),
      session: reader,
      role: reader.role,
      scope: { tenantId: reader.tenantId },
      ip: null,
      userAgent: null,
    };
    const bound = await auditReadFilter(admin("default"), reqCtx);
    return (await log.list({ ...bound, limit: 50, offset: 0 })).total;
  }

  for (const entry of COLUMNS) {
    it(`${entry}: as written by the route`, async () => {
      const migrations = readFileSync(TEMPLATE, "utf8");
      await auditAdapter.applyMigration?.("0001_init", migrations);
      auditDb.exec("DELETE FROM flowpanel_audit_log");
      const { res } = await run("allowed write", entry);
      expect(res.status, await res.clone().text()).toBe(200);
      for (const event of audited) await auditAdapter.auditLog?.append(event);
      const all = audited.length;
      const runsDashboard = entry === "dashboardAction";
      expect(await seenBy(ADMIN)).toBe(all);
      expect(await seenBy(SUPPORT)).toBe(runsDashboard ? 0 : all);
      expect(await seenBy(VIEWER)).toBe(runsDashboard ? 0 : all);
      expect(await seenBy(GUEST)).toBe(0);
    });
  }
});

describe("a menu offers an action exactly when its route lets the caller run it", () => {
  type RowState = "open" | "shipped" | "deleted";
  const config = () => admin("default");
  const orderResource = () => {
    const found = config().resourcesByName.get("orders");
    if (!found) throw new Error("fixture: orders not registered");
    return found;
  };
  const call = (id: string): Call => ({
    id,
    values: { ...BASE_VALUES },
    field: "status",
    input: {},
    origin: "http://localhost",
  });

  function prepare(state: RowState): void {
    resetTables();
    if (state === "shipped") sqlRun("UPDATE orders SET status = 'shipped' WHERE id = 'o-a'");
    if (state === "deleted") sqlRun("UPDATE orders SET deleted_at = 1700000000 WHERE id = 'o-a'");
  }

  async function menus(state: RowState) {
    prepare(state);
    const reqCtx = await buildRequestContext({
      req: new Request("http://localhost/admin/orders"),
      config: config(),
    });
    const row = { id: "o-a", status: state === "shipped" ? "shipped" : "open" };
    const deleted = state === "deleted";
    const listed = await resolveResourceListActions(
      orderResource(),
      [row],
      "id",
      reqCtx,
      DEFAULT_LABELS,
      new Set(deleted ? ["o-a"] : []),
    );
    const record = await recordActions(
      config(),
      orderResource(),
      "orders",
      "o-a",
      row,
      reqCtx,
      deleted,
    );
    const home = config().dashboardsByPath.get("/");
    if (!home) throw new Error("fixture: no overview");
    return {
      row: (listed.rowActionsById?.["o-a"] ?? listed.rowActions).map((a) => a.key),
      recordRow: record.rowActions.map((a) => a.key),
      bulk: deleted ? [] : listed.bulkActions.map((a) => a.key),
      drawer: record.drawerActions.map((a) => a.key),
      dashboard: (await offeredDashboardActions(home, reqCtx)).map((a) => a.key),
      edit: record.editHref !== null,
      delete: record.delete !== null,
    };
  }

  async function allowed(
    state: RowState,
    send: (h: ReturnType<typeof handlers>) => Promise<Response>,
  ) {
    prepare(state);
    const res = await send(handlers(config()));
    return res.status !== 403 && res.status !== 404;
  }

  const rowKeys = ["explode", "resend", "reopen", "ship"];
  const bulkKeys = ["tag", "archive", "delete"];

  for (const reader of [ADMIN, SUPPORT, VIEWER]) {
    for (const state of ["open", "shipped", "deleted"] as const) {
      it(`${reader.role}, ${state} row`, async () => {
        actor = reader;
        const offered = await menus(state);
        expect(offered.recordRow).toEqual(offered.row);
        const h = (key: string) => (handler: ReturnType<typeof handlers>) =>
          handler.POST(json(call("o-a"), "POST", {}), route("orders", "o-a", "actions", key));
        for (const key of rowKeys) {
          expect(await allowed(state, h(key)), `row action ${key}`).toBe(offered.row.includes(key));
        }
        for (const key of bulkKeys) {
          const send = (handler: ReturnType<typeof handlers>) =>
            handler.POST(
              json(call("o-a"), "POST", { ids: ["o-a"] }),
              route("orders", "bulk-actions", key),
            );
          expect(await allowed(state, send), `bulk action ${key}`).toBe(offered.bulk.includes(key));
        }
        const flag = (handler: ReturnType<typeof handlers>) =>
          handler.POST(
            json(call("o-a"), "POST", {}),
            route("drawer", "orders", "o-a", "actions", "flag"),
          );
        expect(await allowed(state, flag), "drawer action flag").toBe(
          offered.drawer.includes("flag"),
        );
        const reset = (handler: ReturnType<typeof handlers>) =>
          handler.POST(
            json(call("o-a"), "POST", {}),
            route("dashboards", "_root_", "actions", "reset"),
          );
        expect(await allowed(state, reset), "dashboard action reset").toBe(
          offered.dashboard.includes("reset"),
        );
        expect(
          await allowed(state, (handler) => ENTRY_POINTS.jsonUpdate(handler, call("o-a"))),
          "Edit",
        ).toBe(offered.edit);
        expect(
          await allowed(state, (handler) => ENTRY_POINTS.jsonDelete(handler, call("o-a"))),
          "Delete",
        ).toBe(offered.delete);
      });
    }
  }
});

describe("New and the empty list's create button show exactly when create runs", () => {
  for (const variant of ["default", "readOnly", "createDisabled"] as const) {
    for (const reader of [ADMIN, SUPPORT, VIEWER]) {
      it(`${reader.role}, ${variant}`, async () => {
        actor = reader;
        const config = admin(variant);
        const orders = config.resourcesByName.get("orders");
        if (!orders) throw new Error("fixture: orders not registered");
        const reqCtx = await buildRequestContext({
          req: new Request("http://localhost/admin/orders"),
          config,
        });
        const button = await buildResourceListCreateAction({
          config,
          resource: orders,
          name: "orders",
          reqCtx,
        });
        const empty = listEmptyProps(config, orders, "orders", "Orders", {
          filtered: false,
          params: new URLSearchParams(),
          creatable: button !== undefined,
        });
        const call: Call = {
          id: "o-a",
          values: { ...BASE_VALUES },
          field: "status",
          input: {},
          origin: "http://localhost",
        };
        for (const send of [ENTRY_POINTS.jsonCreate, ENTRY_POINTS.formCreate]) {
          resetTables();
          const res = await send(handlers(config), call);
          const runs = res.status !== 403 && res.status !== 404;
          expect(button !== undefined, `New (${res.status})`).toBe(runs);
          expect(empty.emptyAction !== undefined, `empty state (${res.status})`).toBe(runs);
        }
      });
    }
  }
});
