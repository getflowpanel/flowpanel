import { MySqlContainer, type StartedMySqlContainer } from "@testcontainers/mysql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaAdapter } from "../adapter";
import type { PrismaDmmf } from "../introspect";
import { generatePrismaClient, isDockerAvailable } from "./provider-clients";

const dmmf: PrismaDmmf = { datamodel: { models: [], enums: [] } };
const dockerAvailable = isDockerAvailable();

describe.skipIf(!dockerAvailable)("prismaAdapter — migrations on MySQL", () => {
  let container: StartedMySqlContainer;
  let prisma: any;
  let adapter: ReturnType<typeof prismaAdapter>;

  beforeAll(async () => {
    container = await new MySqlContainer("mysql:8").start();
    const PrismaClient = generatePrismaClient("mysql.prisma", "test-client-mysql");
    prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    await prisma.$connect();
    adapter = prismaAdapter({ prisma, dmmf, provider: "mysql" });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  async function claimCount(id: string): Promise<number> {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS total FROM _flowpanel_migration_claims WHERE id = ?`,
      id,
    )) as Array<{ total: bigint }>;
    return Number(rows[0]?.total ?? 0);
  }

  it("applies every statement once, records the marker, and releases its claim", async () => {
    await adapter.applyMigration?.(
      "0001_probe",
      `CREATE TABLE probe (id integer PRIMARY KEY, note varchar(32));
       INSERT INTO probe (id, note) VALUES (1, 'one;two');`,
    );
    await adapter.applyMigration?.("0001_probe", `INSERT INTO probe (id, note) VALUES (2, 'no')`);

    const rows = await prisma.$queryRawUnsafe(`SELECT id, note FROM probe ORDER BY id`);
    expect(rows).toEqual([{ id: 1, note: "one;two" }]);
    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_probe"]));
    expect(await claimCount("0001_probe")).toBe(0);
  });

  it("keeps a durable failure claim and refuses to retry until it is cleared", async () => {
    await expect(
      adapter.applyMigration?.(
        "0002_failure",
        `CREATE TABLE partial_probe (id integer); THIS IS NOT SQL;`,
      ),
    ).rejects.toThrow(/durable recovery claim.*statement 2/i);

    const [claim] = (await prisma.$queryRawUnsafe(
      `SELECT state, statement_index FROM _flowpanel_migration_claims WHERE id = ?`,
      "0002_failure",
    )) as Array<{ state: string; statement_index: number }>;
    expect(claim).toMatchObject({ state: "failed", statement_index: 2 });
    expect(await adapter.listAppliedMigrations?.()).not.toContain("0002_failure");

    await expect(
      adapter.applyMigration?.("0002_failure", `CREATE TABLE must_not_retry (id integer)`),
    ).rejects.toThrow(/failed durable claim.*manual recovery/i);

    await prisma.$executeRawUnsafe(
      `DELETE FROM _flowpanel_migration_claims WHERE id = ?`,
      "0002_failure",
    );
  });

  it("serializes concurrent migrators so only one body runs", async () => {
    await Promise.all([
      adapter.applyMigration?.("0003_race", `CREATE TABLE race_first (id integer)`),
      adapter.applyMigration?.("0003_race", `CREATE TABLE race_second (id integer)`),
    ]);

    const tables = (await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN ('race_first', 'race_second')`,
    )) as unknown[];
    expect(tables).toHaveLength(1);
    expect(await adapter.listAppliedMigrations?.()).toContain("0003_race");
    expect(await claimCount("0003_race")).toBe(0);
  });
});
