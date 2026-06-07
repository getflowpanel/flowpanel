import { execSync } from "node:child_process";
import type { MutationContext } from "@flowpanel/core";
import { FlowpanelAccessError } from "@flowpanel/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index.js";

// Check Docker availability synchronously so describe.skipIf works at module load time.
function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = isDockerAvailable();

const items = pgTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  companyId: text("company_id").notNull(),
});

let container: StartedPostgreSqlContainer;
let db: ReturnType<typeof drizzle>;
let client: ReturnType<typeof postgres>;

beforeAll(async () => {
  if (!dockerAvailable) return;
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  client = postgres(container.getConnectionUri());
  db = drizzle(client);
  await client`
    CREATE TABLE items (
      id text PRIMARY KEY,
      name text NOT NULL,
      company_id text NOT NULL
    )
  `;
  // A side effect a compensating DELETE cannot undo: an AFTER INSERT trigger
  // that writes to a second table. A genuine transaction rolls this back
  // together with the INSERT; a write-then-delete does not, because the
  // trigger already committed by the time the DELETE runs.
  await client`
    CREATE TABLE items_audit (
      id serial PRIMARY KEY,
      item_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE FUNCTION items_audit_fn() RETURNS trigger AS $$
    BEGIN
      INSERT INTO items_audit (item_id) VALUES (NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;
  await client`
    CREATE TRIGGER items_audit_trigger AFTER INSERT ON items
    FOR EACH ROW EXECUTE FUNCTION items_audit_fn()
  `;
}, 120_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

// The pre-bound scope predicate for tenant c1 — same shape `scopeBinding`
// would hand the adapter.
const applyScopeC1 = (q: unknown): unknown =>
  (q as { where: (c: unknown) => unknown }).where(eq(items.companyId, "c1"));

function mutCtx(
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
    ...overrides,
  } as MutationContext<unknown>;
}

describe.skipIf(!dockerAvailable)(
  "drizzleAdapter create scope — real transaction rollback (pg)",
  () => {
    const adapter = drizzleAdapter({ db: null as never, schema: { items }, dialect: "pg" });

    it("in-scope create succeeds and is durable, including the trigger side effect", async () => {
      const row = await adapter.create(
        items,
        mutCtx({ id: "ok1", name: "OK", companyId: "c1" }, { applyScope: applyScopeC1 }),
      );
      expect(row).toMatchObject({ id: "ok1", companyId: "c1" });
      const raw = await client`SELECT id FROM items WHERE id = 'ok1'`;
      expect(raw).toHaveLength(1);
      const audit = await client`SELECT item_id FROM items_audit WHERE item_id = 'ok1'`;
      expect(audit).toHaveLength(1);
    });

    it("SECURITY: cross-tenant create is atomically rolled back — no row, no trigger side effect", async () => {
      // Attacker-controlled input hand-crafts a row for a DIFFERENT tenant.
      await expect(
        adapter.create(
          items,
          mutCtx(
            { id: "hacked1", name: "Cross-tenant", companyId: "c2" },
            { applyScope: applyScopeC1 },
          ),
        ),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);

      // No partial state: neither the row nor the trigger's audit side
      // effect survive — proof this is a real ROLLBACK, not a write then a
      // best-effort compensating DELETE that a trigger could outrun.
      const raw = await client`SELECT id FROM items WHERE id = 'hacked1'`;
      expect(raw).toHaveLength(0);
      const audit = await client`SELECT item_id FROM items_audit WHERE item_id = 'hacked1'`;
      expect(audit).toHaveLength(0);
    });

    it("FAIL-CLOSED: create throws when scopeRequired && no applyScope, before writing anything", async () => {
      await expect(
        adapter.create(
          items,
          mutCtx({ id: "shouldnotexist", name: "X", companyId: "c1" }, { scopeRequired: true }),
        ),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      const raw = await client`SELECT id FROM items WHERE id = 'shouldnotexist'`;
      expect(raw).toHaveLength(0);
    });
  },
);
