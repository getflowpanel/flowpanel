import type { ItemQueryContext, ListQueryContext, MutationContext } from "@flowpanel/core";
import { bindAdapterScope, FlowpanelAccessError } from "@flowpanel/core";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index";

const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  companyId: text("company_id").notNull(),
  deletedAt: integer("deleted_at"),
});

let db: ReturnType<typeof drizzle>;
let sqlite: InstanceType<typeof Database>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  sqlite.exec(`
    CREATE TABLE items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company_id TEXT NOT NULL,
      deleted_at INTEGER
    )
  `);
  // Two tenants: c1 owns i1,i2; c2 owns i3.
  sqlite.prepare("INSERT INTO items (id, name, company_id) VALUES (?, ?, ?)").run("i1", "A", "c1");
  sqlite.prepare("INSERT INTO items (id, name, company_id) VALUES (?, ?, ?)").run("i2", "B", "c1");
  sqlite.prepare("INSERT INTO items (id, name, company_id) VALUES (?, ?, ?)").run("i3", "C", "c2");
  // Soft-deleted rows for restore scope tests are inserted inside the restore
  // tests themselves so they don't perturb the list-count assertions above.
});

afterAll(() => {
  sqlite?.close();
});

// The pre-bound scope predicate for tenant c1: AND `company_id = 'c1'` into
// the query — exactly what `scopeBinding` would hand the adapter.
const applyScopeC1 = (q: unknown): unknown =>
  (q as { where: (c: unknown) => unknown }).where(eq(items.companyId, "c1"));

let adapter: ReturnType<typeof drizzleAdapter>;
beforeAll(() => {
  adapter = drizzleAdapter({ db, schema: { items }, dialect: "sqlite" });
});

function listCtx(overrides: Partial<ListQueryContext<unknown>> = {}): ListQueryContext<unknown> {
  return {
    req: new Request("http://localhost/admin/items"),
    session: null,
    role: "admin",
    scope: { companyId: "c1" },
    ip: null,
    userAgent: null,
    db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    filters: {},
    sort: null,
    page: 1,
    pageSize: 50,
    search: "",
    ...overrides,
  } as ListQueryContext<unknown>;
}

function itemCtx(id: string, overrides: Partial<ItemQueryContext> = {}): ItemQueryContext {
  return { ...listCtx(), id, ...overrides } as unknown as ItemQueryContext;
}

function mutCtx(
  id: string,
  input: Record<string, unknown>,
  overrides: Partial<MutationContext<unknown>> = {},
): MutationContext<unknown> {
  return {
    req: new Request("http://localhost/admin/items"),
    session: null,
    role: "admin",
    scope: { companyId: "c1" },
    ip: null,
    userAgent: null,
    db,
    input,
    id,
    ...overrides,
  } as MutationContext<unknown>;
}

describe("drizzleAdapter tenant scope enforcement (sqlite)", () => {
  it("list returns ONLY in-scope rows", async () => {
    const r = await adapter.list(items, listCtx({ boundScope: bindAdapterScope(applyScopeC1) }));
    expect(r.total).toBe(2);
    expect((r.rows as { id: string }[]).map((x) => x.id).sort()).toEqual(["i1", "i2"]);
  });

  it("accepts the opaque v2 bound scope without legacy flags", async () => {
    const result = await adapter.list(
      items,
      listCtx({ boundScope: bindAdapterScope(applyScopeC1) }),
    );
    expect(result.rows.map((row: any) => row.companyId)).toEqual(["c1", "c1"]);
  });

  it("list scope is AND-ed with filters", async () => {
    const r = await adapter.list(
      items,
      listCtx({ filters: { name: "A" }, boundScope: bindAdapterScope(applyScopeC1) }),
    );
    expect(r.total).toBe(1);
    expect((r.rows[0] as { id: string }).id).toBe("i1");
  });

  it("get of an in-scope id returns the row", async () => {
    const row = await adapter.get(
      items,
      itemCtx("i1", { boundScope: bindAdapterScope(applyScopeC1) }),
    );
    expect(row).toMatchObject({ id: "i1" });
  });

  it("get of an OUT-of-scope id returns null", async () => {
    const row = await adapter.get(
      items,
      itemCtx("i3", { boundScope: bindAdapterScope(applyScopeC1) }),
    );
    expect(row).toBeNull();
  });

  it("empty projections retain scope without returning tenant values", async () => {
    const listed = await adapter.list(
      items,
      listCtx({ select: [], boundScope: bindAdapterScope(applyScopeC1) }),
    );
    expect(listed.total).toBe(2);
    expect(listed.rows).toEqual([{}, {}]);
    expect(
      await adapter.get(
        items,
        itemCtx("i1", { select: [], boundScope: bindAdapterScope(applyScopeC1) }),
      ),
    ).toEqual({});
    expect(
      await adapter.get(
        items,
        itemCtx("i3", { select: [], boundScope: bindAdapterScope(applyScopeC1) }),
      ),
    ).toBeNull();
  });

  it("update of an OUT-of-scope id affects 0 rows (returns undefined, row unchanged)", async () => {
    const result = await adapter.update(
      items,
      mutCtx("i3", { name: "HACKED" }, { boundScope: bindAdapterScope(applyScopeC1) }),
    );
    expect(result).toBeUndefined();
    // Confirm the row is untouched.
    const raw = sqlite.prepare("SELECT name FROM items WHERE id = ?").get("i3") as { name: string };
    expect(raw.name).toBe("C");
  });

  it("update of an in-scope id succeeds", async () => {
    const result = await adapter.update(
      items,
      mutCtx("i1", { name: "A2" }, { boundScope: bindAdapterScope(applyScopeC1) }),
    );
    expect(result).toMatchObject({ id: "i1", name: "A2" });
  });

  it("delete of an OUT-of-scope id affects 0 rows", async () => {
    await adapter.delete(items, mutCtx("i3", {}, { boundScope: bindAdapterScope(applyScopeC1) }));
    const raw = sqlite.prepare("SELECT id FROM items WHERE id = ?").get("i3");
    expect(raw).toBeDefined();
  });

  it("delete of an in-scope id removes the row", async () => {
    await adapter.delete(items, mutCtx("i2", {}, { boundScope: bindAdapterScope(applyScopeC1) }));
    const raw = sqlite.prepare("SELECT id FROM items WHERE id = ?").get("i2");
    expect(raw).toBeUndefined();
  });

  it("FAIL-CLOSED: list throws when a bound scope predicate adds no where clause", async () => {
    await expect(
      adapter.list(items, listCtx({ boundScope: bindAdapterScope((query: unknown) => query) })),
    ).rejects.toThrow(/added no where clause/);
  });

  it("no bound scope → unscoped (all rows)", async () => {
    const r = await adapter.list(items, listCtx());
    // i2 was deleted above; remaining is i1 (c1) + i3 (c2).
    expect((r.rows as { id: string }[]).map((x) => x.id).sort()).toEqual(["i1", "i3"]);
  });

  it("restore of an OUT-of-scope id affects 0 rows (row stays soft-deleted)", async () => {
    // i4 belongs to c2 and is soft-deleted.
    sqlite
      .prepare("INSERT INTO items (id, name, company_id, deleted_at) VALUES (?, ?, ?, ?)")
      .run("i4", "D", "c2", Date.now());
    await adapter.restore?.(
      items,
      mutCtx(
        "i4",
        {},
        { boundScope: bindAdapterScope(applyScopeC1), softDelete: { column: "deletedAt" } },
      ),
    );
    const raw = sqlite.prepare("SELECT deleted_at FROM items WHERE id = ?").get("i4") as {
      deleted_at: number | null;
    };
    expect(raw.deleted_at).not.toBeNull();
  });

  it("restore of an in-scope id clears deleted_at", async () => {
    // i5 belongs to c1 and is soft-deleted.
    sqlite
      .prepare("INSERT INTO items (id, name, company_id, deleted_at) VALUES (?, ?, ?, ?)")
      .run("i5", "E", "c1", Date.now());
    await adapter.restore?.(
      items,
      mutCtx(
        "i5",
        {},
        { boundScope: bindAdapterScope(applyScopeC1), softDelete: { column: "deletedAt" } },
      ),
    );
    const raw = sqlite.prepare("SELECT deleted_at FROM items WHERE id = ?").get("i5") as {
      deleted_at: number | null;
    };
    expect(raw.deleted_at).toBeNull();
  });

  it("create with an in-scope tenant value succeeds", async () => {
    const row = await adapter.create(items, {
      req: new Request("http://localhost/admin/items"),
      session: null,
      role: "admin",
      scope: { companyId: "c1" },
      ip: null,
      userAgent: null,
      db,
      input: { id: "c1new", name: "New in c1", companyId: "c1" },
      boundScope: bindAdapterScope(applyScopeC1),
    } as unknown as MutationContext<unknown>);
    expect(row).toMatchObject({ id: "c1new", companyId: "c1" });
    const raw = sqlite.prepare("SELECT id FROM items WHERE id = ?").get("c1new");
    expect(raw).toBeDefined();
  });

  it("SECURITY: create with a cross-tenant value is refused and rolled back, not written", async () => {
    await expect(
      adapter.create(items, {
        req: new Request("http://localhost/admin/items"),
        session: null,
        role: "admin",
        scope: { companyId: "c1" },
        ip: null,
        userAgent: null,
        db,
        // Attacker-controlled input hand-crafts a row for a DIFFERENT tenant.
        input: { id: "hacked1", name: "Cross-tenant", companyId: "c2" },
        boundScope: bindAdapterScope(applyScopeC1),
      } as unknown as MutationContext<unknown>),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
    // The row must not have been left behind by the rollback.
    const raw = sqlite.prepare("SELECT id FROM items WHERE id = ?").get("hacked1");
    expect(raw).toBeUndefined();
  });

  it("SECURITY: update that sets the tenant column to another tenant is refused and the row is unchanged", async () => {
    sqlite
      .prepare("INSERT INTO items (id, name, company_id) VALUES (?, ?, ?)")
      .run("move1", "Before", "c1");
    await expect(
      adapter.update(
        items,
        mutCtx(
          "move1",
          { name: "After", companyId: "c2" },
          { boundScope: bindAdapterScope(applyScopeC1) },
        ),
      ),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
    const raw = sqlite.prepare("SELECT name, company_id FROM items WHERE id = ?").get("move1");
    expect(raw).toEqual({ name: "Before", company_id: "c1" });
  });

  it("update that keeps the tenant column at the scope's value succeeds", async () => {
    const row = await adapter.update(
      items,
      mutCtx(
        "move1",
        { name: "After", companyId: "c1" },
        { boundScope: bindAdapterScope(applyScopeC1) },
      ),
    );
    expect(row).toMatchObject({ id: "move1", name: "After", companyId: "c1" });
  });

  it("SECURITY: an out-of-scope create never writes the row, not even briefly", async () => {
    const seen: string[] = [];
    sqlite.function("fp_seen", (id: string) => {
      seen.push(id);
      return null;
    });
    sqlite.exec(
      "CREATE TRIGGER items_seen AFTER INSERT ON items BEGIN SELECT fp_seen(NEW.id); END",
    );
    try {
      await expect(
        adapter.create(
          items,
          mutCtx(
            "",
            { id: "hacked2", name: "Cross-tenant", companyId: "c2" },
            { boundScope: bindAdapterScope(applyScopeC1) },
          ),
        ),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      expect(seen).toEqual([]);
    } finally {
      sqlite.exec("DROP TRIGGER items_seen");
    }
  });
});

describe("drizzleAdapter scope probe on sqlite", () => {
  const ledger = sqliteTable("ledger", {
    id: text("id").primaryKey(),
    tenant: integer("tenant"),
    region: text("region").$defaultFn(() => "eu"),
  });
  const conn = new Database(":memory:");
  const ledgerDb = drizzle(conn);
  conn.exec("CREATE TABLE ledger (id TEXT PRIMARY KEY, tenant INTEGER, region TEXT)");
  conn.exec("INSERT INTO ledger VALUES ('a', 16, 'eu')");
  const ledgerAdapter = drizzleAdapter({ db: ledgerDb, schema: { ledger }, dialect: "sqlite" });
  const ctx = (input: Record<string, unknown>, apply: (q: unknown) => unknown, id = "a") =>
    ({
      req: new Request("http://localhost/"),
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db: ledgerDb,
      id,
      input,
      boundScope: bindAdapterScope(apply),
    }) as unknown as MutationContext<unknown>;
  const tenant16 = (q: unknown) =>
    (q as { where: (c: unknown) => unknown }).where(eq(ledger.tenant, 16));
  const inEu = (q: unknown) =>
    (q as { where: (c: unknown) => unknown }).where(eq(ledger.region, "eu"));

  afterAll(() => conn.close());

  it("SECURITY: reads number text the way SQLite stores it, so 0x10 is not 16", async () => {
    await expect(
      ledgerAdapter.update(ledger, ctx({ tenant: "0x10" }, tenant16)),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
    expect(await ledgerAdapter.update(ledger, ctx({ tenant: "16" }, tenant16))).toMatchObject({
      tenant: 16,
    });
  });

  it("creates a row whose scoped column comes from $defaultFn", async () => {
    expect(await ledgerAdapter.create(ledger, ctx({ id: "b", tenant: 1 }, inEu))).toMatchObject({
      id: "b",
      region: "eu",
    });
  });

  it("answers not found for an update that renames a missing row's key", async () => {
    const plain = { ...ctx({ id: "a", tenant: 2 }, tenant16, "missing") };
    Reflect.deleteProperty(plain, "boundScope");
    expect(await ledgerAdapter.update(ledger, plain)).toBeUndefined();
    expect(conn.prepare("SELECT tenant FROM ledger WHERE id = 'a'").get()).toEqual({ tenant: 16 });
  });
});
