import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaAdapter } from "../adapter";
import type { PrismaDmmf } from "../introspect";
import { checkedDmmf } from "../runtime";
import { generatedDmmf, generatePrismaClient, isDockerAvailable } from "./provider-clients";

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

describe.skipIf(!dockerAvailable)("prismaAdapter — writes on PostgreSQL", () => {
  let container: StartedPostgreSqlContainer;
  let prisma: any;
  let adapter: ReturnType<typeof prismaAdapter>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const PrismaClient = generatePrismaClient("postgres.prisma", "test-client-postgres");
    prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`CREATE TABLE "TestUser" (
      id serial PRIMARY KEY, email text NOT NULL UNIQUE, name text,
      active boolean NOT NULL DEFAULT true, age integer, "deletedAt" timestamp(3),
      "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE test_orders (
      id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES "TestUser"(id),
      total numeric(10, 2) NOT NULL, status text NOT NULL DEFAULT 'pending')`);
    adapter = prismaAdapter({
      prisma,
      dmmf: checkedDmmf(generatedDmmf("test-client-postgres")),
      provider: "postgresql",
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("creates rows from the required columns and lets the database fill the defaults", async () => {
    const user = adapter.inferSchema("TestUser").create.safeParse({ email: "ann@example.com" });
    expect(user.success).toBe(true);
    const created = (await adapter.create("TestUser", { input: user.data } as any)) as {
      id: number;
      createdAt: Date;
    };
    expect(created.createdAt).toBeInstanceOf(Date);

    const order = adapter
      .inferSchema("TestOrder")
      .create.safeParse({ userId: created.id, total: 12.5 });
    expect(order.success).toBe(true);
    const placed = (await adapter.create("TestOrder", { input: order.data } as any)) as {
      status: string;
    };
    expect(placed.status).toBe("pending");
  });

  it("compares a timestamp column with a Date bound in ctx.sql, as a dashboard does", async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TestUser" (email, "createdAt") VALUES ('old@example.com', '2020-01-01'), ('new@example.com', '2026-03-01')`,
    );
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2027-01-01T00:00:00.000Z");
    const run = adapter.sql;
    if (!run) throw new Error("fixture: the sql capability is missing");
    const rows = await run<{ email: string }>`
      select email from "TestUser" where "createdAt" >= ${from} and "createdAt" < ${to} order by email`;
    expect(rows.map((row) => row.email)).toContain("new@example.com");
    expect(rows.map((row) => row.email)).not.toContain("old@example.com");
  });

  it("reports a missing foreign key with the constraint Prisma names", async () => {
    const error = await adapter
      .create("TestOrder", { input: { userId: 999_999, total: 1 } } as any)
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      code: "P2003",
      meta: { field_name: expect.stringMatching(/^test_orders_user_id_fkey/) },
    });
  });
});
