import type { ListQueryContext } from "@flowpanel/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { execSync } from "node:child_process";
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

const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  active: boolean("active").notNull().default(true),
  age: integer("age"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
    CREATE TABLE users (
      id text PRIMARY KEY,
      email text NOT NULL,
      name text,
      active boolean NOT NULL DEFAULT true,
      age integer,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  for (let i = 0; i < 25; i++) {
    await client`
      INSERT INTO users (id, email, name, age)
      VALUES (${`u${i}`}, ${`u${i}@e.co`}, ${`User ${i}`}, ${20 + i})
    `;
  }
}, 120_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

function ctx(overrides: Partial<ListQueryContext<any>> = {}): ListQueryContext<any> {
  return {
    req: new Request("http://localhost/admin/users"),
    session: null,
    role: "admin",
    scope: null,
    ip: null,
    userAgent: null,
    db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    filters: {},
    sort: null,
    page: 1,
    pageSize: 10,
    search: "",
    ...overrides,
  } as ListQueryContext<any>;
}

describe.skipIf(!dockerAvailable)("drizzleAdapter CRUD", () => {
  const adapter = drizzleAdapter({ db: null as any, schema: { users }, dialect: "pg" });

  it("list returns rows with pagination", async () => {
    const r = await adapter.list(users, ctx({ db, pageSize: 10, page: 1 }));
    expect(r.total).toBe(25);
    expect(r.rows).toHaveLength(10);
  });

  it("list sort ascending", async () => {
    const r = await adapter.list(
      users,
      ctx({ db, sort: { field: "age", dir: "asc" }, pageSize: 5 }),
    );
    expect((r.rows[0] as any).age).toBe(20);
  });

  it("list filter by equality", async () => {
    const r = await adapter.list(users, ctx({ db, filters: { email: "u5@e.co" } }));
    expect(r.total).toBe(1);
    expect((r.rows[0] as any).id).toBe("u5");
  });

  it("list search across text columns", async () => {
    const r = await adapter.list(users, ctx({ db, search: "User 7" }));
    expect(r.rows.some((row: any) => row.id === "u7")).toBe(true);
  });

  it("get returns a row or null", async () => {
    expect(await adapter.get(users, { ...ctx({ db }), id: "u3" } as any)).toMatchObject({
      id: "u3",
    });
    expect(await adapter.get(users, { ...ctx({ db }), id: "nope" } as any)).toBeNull();
  });

  it("create, update, delete roundtrip", async () => {
    const created: any = await adapter.create(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      input: { id: "new1", email: "new@e.co", name: "New" },
    } as any);
    expect(created).toMatchObject({ id: "new1", email: "new@e.co" });

    await adapter.update(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      id: "new1",
      input: { name: "Updated" },
    } as any);

    const after: any = await adapter.get(users, { ...ctx({ db }), id: "new1" } as any);
    expect(after.name).toBe("Updated");

    await adapter.delete(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      id: "new1",
      input: {},
    } as any);

    expect(await adapter.get(users, { ...ctx({ db }), id: "new1" } as any)).toBeNull();
  });
});
