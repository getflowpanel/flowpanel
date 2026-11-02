import { execSync } from "node:child_process";
import type { ItemQueryContext, MutationContext } from "@flowpanel/core";
import { MySqlContainer, type StartedMySqlContainer } from "@testcontainers/mysql";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { date, int, mysqlTable } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import { integer, date as pgDate, pgTable } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import * as mysql from "mysql2/promise";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index";

function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = isDockerAvailable();
const hostZone = process.env.TZ;

const events = mysqlTable("events", {
  id: int("id").primaryKey(),
  day: date("day", { mode: "date" }),
});

let container: StartedMySqlContainer;
let pool: mysql.Pool;

beforeAll(async () => {
  if (!dockerAvailable) return;
  // mysql2 writes a Date on the Node process's own clock; west of UTC that is the day before.
  process.env.TZ = "America/New_York";
  container = await new MySqlContainer("mysql:8").start();
  pool = mysql.createPool(container.getConnectionUri());
  await pool.query("CREATE TABLE events (id INT PRIMARY KEY, day DATE)");
}, 120_000);

afterAll(async () => {
  if (hostZone === undefined) delete process.env.TZ;
  else process.env.TZ = hostZone;
  await pool?.end();
  await container?.stop();
});

async function storedDay(id: number): Promise<string> {
  const [rows] = await pool.query(
    "SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day FROM events WHERE id = ?",
    [id],
  );
  return (rows as Array<{ day: string }>)[0]?.day ?? "";
}

describe.skipIf(!dockerAvailable)("a MySQL date column, written from a server west of UTC", () => {
  const adapter = () => drizzleAdapter({ db: drizzle(pool), schema: { events } });

  it("stores and reads back the calendar day it was given", async () => {
    await adapter().create(events, {
      input: { id: 1, day: new Date("2026-10-25T00:00:00.000Z") },
    } as unknown as MutationContext<unknown>);
    expect(await storedDay(1)).toBe("2026-10-25");
    const row = await adapter().get(events, { id: "1" } as unknown as ItemQueryContext<unknown>);
    expect((row as { day: Date }).day.toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });

  it("keeps the day an update sets", async () => {
    await adapter().update(events, {
      id: "1",
      input: { day: new Date("2026-10-26T00:00:00.000Z") },
    } as unknown as MutationContext<unknown>);
    expect(await storedDay(1)).toBe("2026-10-26");
  });
});

const pgEvents = pgTable("events", {
  id: integer("id").primaryKey(),
  day: pgDate("day", { mode: "date" }),
});

describe.skipIf(!dockerAvailable)(
  "a PostgreSQL date column, written from a server west of UTC",
  () => {
    let pgContainer: StartedPostgreSqlContainer;
    let client: postgres.Sql;

    beforeAll(async () => {
      pgContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
      client = postgres(pgContainer.getConnectionUri());
      await client.unsafe("CREATE TABLE events (id integer PRIMARY KEY, day date)");
    }, 120_000);

    afterAll(async () => {
      await client?.end();
      await pgContainer?.stop();
    });

    it("stores and reads back the calendar day it was given", async () => {
      const adapter = drizzleAdapter({ db: drizzlePg(client), schema: { events: pgEvents } });
      await adapter.create(pgEvents, {
        input: { id: 1, day: new Date("2026-10-25T00:00:00.000Z") },
      } as unknown as MutationContext<unknown>);
      const rows = await client.unsafe("SELECT to_char(day, 'YYYY-MM-DD') AS day FROM events");
      expect(rows[0]?.day).toBe("2026-10-25");
      const row = await adapter.get(pgEvents, { id: "1" } as unknown as ItemQueryContext<unknown>);
      expect((row as { day: Date }).day.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    });
  },
);
