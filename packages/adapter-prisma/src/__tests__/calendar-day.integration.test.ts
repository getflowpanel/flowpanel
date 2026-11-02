import { MySqlContainer } from "@testcontainers/mysql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaAdapter } from "../adapter";
import { checkedDmmf } from "../runtime";
import { generatedDmmf, generatePrismaClient, isDockerAvailable } from "./provider-clients";

const dockerAvailable = isDockerAvailable();
const hostZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "America/New_York";
});
afterAll(() => {
  if (hostZone === undefined) delete process.env.TZ;
  else process.env.TZ = hostZone;
});

describe.skipIf(!dockerAvailable).each([
  ["PostgreSQL", "postgresql", "postgres.prisma", "test-client-postgres"],
  ["MySQL", "mysql", "mysql.prisma", "test-client-mysql"],
] as const)(
  "a %s @db.Date field, written from a server west of UTC",
  (_name, provider, schema, output) => {
    let container: { stop(): Promise<unknown>; getConnectionUri(): string };
    let prisma: any;

    beforeAll(async () => {
      container =
        provider === "postgresql"
          ? await new PostgreSqlContainer("postgres:16-alpine").start()
          : await new MySqlContainer("mysql:8").start();
      const PrismaClient = generatePrismaClient(schema, output);
      prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
      await prisma.$executeRawUnsafe(
        "CREATE TABLE calendar_events (id integer PRIMARY KEY, day date)",
      );
    }, 180_000);

    afterAll(async () => {
      await prisma?.$disconnect();
      await container?.stop();
    });

    it("stores and reads back the calendar day it was given", async () => {
      const adapter = prismaAdapter({ prisma, provider, dmmf: checkedDmmf(generatedDmmf(output)) });
      await adapter.create("CalendarEvent", {
        input: { id: 1, day: new Date("2026-10-25T00:00:00.000Z") },
      } as never);
      const rows = (await prisma.$queryRawUnsafe(
        provider === "postgresql"
          ? "SELECT to_char(day, 'YYYY-MM-DD') AS day FROM calendar_events"
          : "SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day FROM calendar_events",
      )) as Array<{ day: string }>;
      expect(rows[0]?.day).toBe("2026-10-25");
      const row = (await adapter.get("CalendarEvent", { id: "1" } as never)) as { day: Date };
      expect(row.day.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    });
  },
);
