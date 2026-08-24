import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaAdapter } from "../adapter.js";

const require = createRequire(import.meta.url);

// Try to load the generated test client. If prisma generate hasn't run
// (e.g. CI without network), skip the suite gracefully.
let PrismaClient: any;
let Prisma: any;
let clientGenerated = false;

try {
  const mod = require("../../node_modules/.prisma/test-client");
  PrismaClient = mod.PrismaClient;
  Prisma = mod.Prisma;
  clientGenerated = true;
} catch {
  // Integration tests will be skipped
}

type TestRow = {
  id: number | string;
  email: string;
  name?: string | null;
  active?: number;
  age?: number | null;
  deletedAt?: Date | null;
  createdAt?: Date;
};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "TestUser" (
    "id"        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email"     TEXT NOT NULL UNIQUE,
    "name"      TEXT,
    "active"    INTEGER NOT NULL DEFAULT 1,
    "age"       INTEGER,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

describe.skipIf(!clientGenerated)("prismaAdapter — SQLite integration", () => {
  let prisma: any;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: "file::memory:?cache=shared" } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
    await prisma.$executeRawUnsafe(`DELETE FROM "TestUser"`);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "TestUser"`);
    await prisma.$disconnect();
  });

  it("list paginates: 5 seeded rows, page=1 size=3 → total 5, rows 3", async () => {
    // Seed 5 rows
    for (let i = 1; i <= 5; i++) {
      await prisma.testUser.create({ data: { email: `seed${i}@example.com`, name: `User ${i}` } });
    }

    const adapter = prismaAdapter({ prisma, dmmf: Prisma.dmmf });
    const result = await adapter.list("TestUser", {
      page: 1,
      pageSize: 3,
      filters: {},
      db: undefined,
    } as any);

    expect(result.total).toBe(5);
    expect(result.rows).toHaveLength(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
  });

  it("numeric-range filter: `gte`/`lte` return only in-range rows, never throws", async () => {
    // Reproduces the reported bug class: an undecoded "min:max" string used
    // to reach the query layer verbatim and blow up (or, for prisma, throw
    // a validation error) instead of filtering. `age` is untouched by every
    // other test in this file (always NULL there), so a distinctive range
    // isolates these rows regardless of test order.
    const adapter = prismaAdapter({ prisma, dmmf: Prisma.dmmf });
    for (let i = 0; i < 5; i++) {
      await adapter.create("TestUser", {
        input: { email: `range${i}@filtertest.com`, age: 1000 + i },
        db: undefined,
      } as any);
    }

    const r = await adapter.list("TestUser", {
      page: 1,
      pageSize: 50,
      filters: { age: { op: "range", gte: 1001, lte: 1003 } },
      db: undefined,
    } as any);
    expect(r.total).toBe(3);
    expect(
      (r.rows as TestRow[]).every(
        (row) => (row.age as number) >= 1001 && (row.age as number) <= 1003,
      ),
    ).toBe(true);

    const gteOnly = await adapter.list("TestUser", {
      page: 1,
      pageSize: 50,
      filters: { age: { op: "range", gte: 1004 } },
      db: undefined,
    } as any);
    expect(gteOnly.total).toBe(1);
  });

  it("daterange filter: `gte`/`lte` return only in-range rows, never throws", async () => {
    const adapter = prismaAdapter({ prisma, dmmf: Prisma.dmmf });
    const inRange = (await adapter.create("TestUser", {
      input: { email: "daterange-in@filtertest.com", createdAt: new Date("2020-02-01T00:00:00Z") },
      db: undefined,
    } as any)) as TestRow;
    await adapter.create("TestUser", {
      input: { email: "daterange-out@filtertest.com", createdAt: new Date("2021-06-15T00:00:00Z") },
      db: undefined,
    } as any);

    const r = await adapter.list("TestUser", {
      page: 1,
      pageSize: 50,
      filters: {
        createdAt: {
          op: "range",
          gte: new Date("2020-01-01T00:00:00Z"),
          lte: new Date("2020-03-01T00:00:00Z"),
        },
      },
      db: undefined,
    } as any);
    expect(r.total).toBe(1);
    expect((r.rows[0] as TestRow).id).toBe(inRange.id);
  });

  it("multiselect filter: returns the UNION of matching rows, never matches nothing", async () => {
    // Reproduces the reported bug: an undecoded CSV string used to silently
    // match zero rows — worse than a crash because nobody notices. Filters
    // on `email` (String) rather than `id` (Int) — a `multiselect` value is
    // always `string[]`, and prisma validates arg types against the schema.
    const adapter = prismaAdapter({ prisma, dmmf: Prisma.dmmf });
    const a = (await adapter.create("TestUser", {
      input: { email: "in-a@filtertest.com" },
      db: undefined,
    } as any)) as TestRow;
    const b = (await adapter.create("TestUser", {
      input: { email: "in-b@filtertest.com" },
      db: undefined,
    } as any)) as TestRow;

    const r = await adapter.list("TestUser", {
      page: 1,
      pageSize: 50,
      filters: { email: { op: "in", values: [a.email, b.email, "nope@filtertest.com"] } },
      db: undefined,
    } as any);
    expect(r.total).toBe(2);
    expect((r.rows as TestRow[]).map((row) => row.email).sort()).toEqual([a.email, b.email].sort());
  });

  it("get returns row or null", async () => {
    const created = await prisma.testUser.create({
      data: { email: "get-test@example.com" },
    });

    const adapter = prismaAdapter({ prisma, dmmf: Prisma.dmmf });
    const found = (await adapter.get("TestUser", {
      id: String(created.id),
      db: undefined,
    } as any)) as TestRow;
    expect(found).not.toBeNull();
    expect(found.email).toBe("get-test@example.com");

    const notFound = await adapter.get("TestUser", { id: "99999", db: undefined } as any);
    expect(notFound).toBeNull();
  });

  it("create + update + delete roundtrip", async () => {
    const adapter = prismaAdapter({ prisma, dmmf: Prisma.dmmf });

    const created = (await adapter.create("TestUser", {
      input: { email: "crud@example.com", active: true },
      db: undefined,
    } as any)) as TestRow;
    expect(created.id).toBeDefined();
    expect(created.email).toBe("crud@example.com");

    const updated = (await adapter.update("TestUser", {
      id: String(created.id),
      input: { name: "Updated Name" },
      db: undefined,
    } as any)) as TestRow;
    expect(updated.name).toBe("Updated Name");

    await adapter.delete!("TestUser", { id: String(created.id), input: {}, db: undefined } as any);
    const gone = await adapter.get("TestUser", { id: String(created.id), db: undefined } as any);
    expect(gone).toBeNull();
  });

  it("soft-delete + restore roundtrip", async () => {
    const adapter = prismaAdapter({ prisma, dmmf: Prisma.dmmf });

    const created = (await adapter.create("TestUser", {
      input: { email: "softdel@example.com" },
      db: undefined,
    } as any)) as TestRow;

    const createdIdStr = String(created.id);

    // Soft-delete
    await adapter.delete!("TestUser", {
      id: createdIdStr,
      input: {},
      softDelete: { column: "deletedAt" },
      db: undefined,
    } as any);

    // Should be excluded from list
    const listAfterDelete = await adapter.list("TestUser", {
      page: 1,
      pageSize: 100,
      filters: { email: "softdel@example.com" },
      softDelete: { column: "deletedAt" },
      db: undefined,
    } as any);
    expect(listAfterDelete.rows.find((r: any) => r.id === created.id)).toBeUndefined();

    // Restore
    await adapter.restore!("TestUser", {
      id: createdIdStr,
      input: {},
      softDelete: { column: "deletedAt" },
      db: undefined,
    } as any);

    const restored = (await adapter.get("TestUser", {
      id: createdIdStr,
      db: undefined,
    } as any)) as TestRow;
    expect(restored).not.toBeNull();
    expect(restored.deletedAt).toBeNull();
  });
});
