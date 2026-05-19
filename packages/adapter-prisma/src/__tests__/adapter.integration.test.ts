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
