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
    adapter = prismaAdapter({ prisma, provider: "sqlite" });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_migrations`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_probe`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_first_probe`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_second_probe`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_rollback_probe`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_apply_probe`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_race_first`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_race_second`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _flowpanel_migration_lock`);
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

  it("runs every statement before the caller records the migration through the legacy hooks", async () => {
    await adapter.runMigrationSql?.(
      `CREATE TABLE _flowpanel_first_probe (id INTEGER PRIMARY KEY);
       CREATE TABLE _flowpanel_second_probe (id INTEGER PRIMARY KEY);`,
    );
    await adapter.markMigrationApplied?.("0003_multi");

    const tables = (await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('_flowpanel_first_probe', '_flowpanel_second_probe') ORDER BY name`,
    )) as Array<{ name: string }>;
    expect(tables.map(({ name }) => name)).toEqual([
      "_flowpanel_first_probe",
      "_flowpanel_second_probe",
    ]);
    expect(await adapter.listAppliedMigrations?.()).toContain("0003_multi");
  });

  it("rolls back earlier statements in the SQL hook and leaves the migration unrecorded", async () => {
    await expect(
      adapter.runMigrationSql?.(
        `CREATE TABLE _flowpanel_rollback_probe (id INTEGER PRIMARY KEY);
         THIS IS NOT VALID SQL;`,
      ),
    ).rejects.toThrow();

    const tables = (await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_flowpanel_rollback_probe'`,
    )) as Array<{ name: string }>;
    expect(tables).toEqual([]);
    expect(await adapter.listAppliedMigrations?.()).not.toContain("0004_rollback");
  });

  it("applies every statement once and never replays a recorded id", async () => {
    await adapter.applyMigration?.(
      "0005_apply",
      `CREATE TABLE _flowpanel_apply_probe (id INTEGER PRIMARY KEY, note TEXT);
       INSERT INTO _flowpanel_apply_probe (id, note) VALUES (1, 'one;two');`,
    );
    await adapter.applyMigration?.(
      "0005_apply",
      `INSERT INTO _flowpanel_apply_probe (id, note) VALUES (2, 'no')`,
    );

    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, note FROM _flowpanel_apply_probe ORDER BY id`,
    );
    expect(rows).toEqual([{ id: 1, note: "one;two" }]);
    expect(await adapter.listAppliedMigrations?.()).toContain("0005_apply");
  });

  it("serializes concurrent migrators so only one body runs", async () => {
    await Promise.all([
      adapter.applyMigration?.("0006_race", `CREATE TABLE _flowpanel_race_first (id INTEGER)`),
      adapter.applyMigration?.("0006_race", `CREATE TABLE _flowpanel_race_second (id INTEGER)`),
    ]);

    const tables = (await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name IN ('_flowpanel_race_first', '_flowpanel_race_second')`,
    )) as Array<{ name: string }>;
    expect(tables).toHaveLength(1);
    expect(await adapter.listAppliedMigrations?.()).toContain("0006_race");
  });
});
