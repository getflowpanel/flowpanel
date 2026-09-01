import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaAdapter } from "../adapter";
import type { PrismaDmmf } from "../introspect";
import { generatePrismaClient, isDockerAvailable } from "./provider-clients";

const dmmf: PrismaDmmf = { datamodel: { models: [], enums: [] } };
const dockerAvailable = isDockerAvailable();

describe.skipIf(!dockerAvailable)("prismaAdapter — migrations on PostgreSQL", () => {
  let container: StartedPostgreSqlContainer;
  let prisma: any;
  let adapter: ReturnType<typeof prismaAdapter>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const PrismaClient = generatePrismaClient("postgres.prisma", "test-client-postgres");
    prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    await prisma.$connect();
    adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("applies every statement once and never replays a recorded id", async () => {
    await adapter.applyMigration?.(
      "0001_probe",
      `CREATE TABLE probe (id integer PRIMARY KEY, note text);
       INSERT INTO probe (id, note) VALUES (1, 'one;two');`,
    );
    await adapter.applyMigration?.("0001_probe", `INSERT INTO probe (id, note) VALUES (2, 'no')`);

    const rows = await prisma.$queryRawUnsafe(`SELECT id, note FROM probe ORDER BY id`);
    expect(rows).toEqual([{ id: 1, note: "one;two" }]);
    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_probe"]));
  });

  it("rolls the whole file back and records nothing when a statement fails", async () => {
    await expect(
      adapter.applyMigration?.(
        "0002_failure",
        `CREATE TABLE rollback_probe (id integer); THIS IS NOT SQL;`,
      ),
    ).rejects.toThrow();

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT to_regclass('rollback_probe') IS NULL AS missing`,
    )) as Array<{ missing: boolean }>;
    expect(rows[0]?.missing).toBe(true);
    expect(await adapter.listAppliedMigrations?.()).not.toContain("0002_failure");
  });

  it("serializes concurrent migrators so only one body runs", async () => {
    await Promise.all([
      adapter.applyMigration?.("0003_race", `CREATE TABLE race_first (id integer)`),
      adapter.applyMigration?.("0003_race", `CREATE TABLE race_second (id integer)`),
    ]);

    const tables = (await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE tablename IN ('race_first', 'race_second')`,
    )) as Array<{ tablename: string }>;
    expect(tables).toHaveLength(1);
    expect(await adapter.listAppliedMigrations?.()).toContain("0003_race");
  });
});
