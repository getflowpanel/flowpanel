import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

const users = pgTable("users_soft", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
});

let container: StartedPostgreSqlContainer;
let db: ReturnType<typeof drizzle>;
let client: ReturnType<typeof postgres>;
let adapter: ReturnType<typeof drizzleAdapter>;

beforeAll(async () => {
  if (!dockerAvailable) return;
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  client = postgres(container.getConnectionUri());
  db = drizzle(client);
  await client`
    CREATE TABLE users_soft (
      id text PRIMARY KEY,
      email text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      deleted_at timestamp
    )
  `;
  adapter = drizzleAdapter({ db, schema: { users } });
}, 120_000);

afterAll(async () => {
  await client?.end({ timeout: 5 });
  await container?.stop();
});

beforeEach(async () => {
  if (!dockerAvailable) return;
  await client`DELETE FROM users_soft`;
});

const baseCtx = (overrides: Record<string, unknown> = {}) => ({
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
  db,
  dateRange: { from: new Date(0), to: new Date() },
  searchParams: new URLSearchParams(""),
  signal: new AbortController().signal,
  ...overrides,
});

describe.skipIf(!dockerAvailable)("Drizzle adapter soft-delete", () => {
  it("list WITHOUT softDelete ctx returns all rows", async () => {
    await db.insert(users).values([
      { id: "1", email: "a@x.com" },
      { id: "2", email: "b@x.com", deletedAt: new Date() },
    ]);
    const r = await adapter.list(
      users,
      baseCtx({
        filters: {},
        sort: null,
        page: 1,
        pageSize: 10,
        search: "",
      }) as never,
    );
    expect(r.total).toBe(2);
  });

  it("list WITH softDelete ctx filters out rows where column IS NOT NULL", async () => {
    await db.insert(users).values([
      { id: "1", email: "a@x.com" },
      { id: "2", email: "b@x.com", deletedAt: new Date() },
    ]);
    const r = await adapter.list(
      users,
      baseCtx({
        filters: {},
        sort: null,
        page: 1,
        pageSize: 10,
        search: "",
        softDelete: { column: "deletedAt" },
      }) as never,
    );
    expect(r.total).toBe(1);
    expect((r.rows[0] as { id: string } | undefined)?.id).toBe("1");
  });

  it("delete WITH softDelete ctx issues UPDATE … SET <col> = now() instead of DELETE", async () => {
    await db.insert(users).values([{ id: "1", email: "a@x.com" }]);
    await adapter.delete(
      users,
      baseCtx({ id: "1", input: {}, softDelete: { column: "deletedAt" } }) as never,
    );
    const rows = await db.select().from(users).where(eq(users.id, "1"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date);
  });

  it("delete WITHOUT softDelete ctx still issues DELETE", async () => {
    await db.insert(users).values([{ id: "1", email: "a@x.com" }]);
    await adapter.delete(users, baseCtx({ id: "1", input: {} }) as never);
    const rows = await db.select().from(users).where(eq(users.id, "1"));
    expect(rows).toHaveLength(0);
  });

  it("restore sets <col> = NULL", async () => {
    await db.insert(users).values([{ id: "1", email: "a@x.com", deletedAt: new Date() }]);
    await adapter.restore?.(
      users,
      baseCtx({ id: "1", input: {}, softDelete: { column: "deletedAt" } }) as never,
    );
    const rows = await db.select().from(users).where(eq(users.id, "1"));
    expect(rows[0]?.deletedAt).toBeNull();
  });

  it("restore without softDelete ctx throws", async () => {
    await db.insert(users).values([{ id: "1", email: "a@x.com", deletedAt: new Date() }]);
    await expect(
      adapter.restore?.(users, baseCtx({ id: "1", input: {} }) as never),
    ).rejects.toThrow(/softDelete/);
  });
});
