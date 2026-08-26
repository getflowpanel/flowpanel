import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaAdapter } from "../adapter";

const require = createRequire(import.meta.url);

let PrismaClient: any;
let clientGenerated = false;

try {
  PrismaClient = require("../../node_modules/.prisma/test-client").PrismaClient;
  clientGenerated = true;
} catch {
  // Integration tests will be skipped
}

describe.skipIf(!clientGenerated)("prismaAdapter — migrations on SQLite", () => {
  let prisma: any;
  let adapter: ReturnType<typeof prismaAdapter>;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: "file::memory:?cache=shared" } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_migrations`);
    adapter = prismaAdapter({ prisma });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_migrations`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_probe`);
    await prisma.$disconnect();
  });

  it("creates its bookkeeping table and round-trips applied ids", async () => {
    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set());

    await adapter.markMigrationApplied?.("0001_init");
    await adapter.markMigrationApplied?.("0002_posts");

    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_init", "0002_posts"]));
  });

  it("executes raw migration SQL", async () => {
    await adapter.runMigrationSql?.(
      `CREATE TABLE _flowpanel_probe (id INTEGER NOT NULL PRIMARY KEY)`,
    );
    const rows = await prisma.$queryRawUnsafe(`SELECT id FROM _flowpanel_probe`);
    expect(rows).toEqual([]);
  });
});
