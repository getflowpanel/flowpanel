import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { MySqlContainer, type StartedMySqlContainer } from "@testcontainers/mysql";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { mysqlTable, varchar as mysqlVarchar } from "drizzle-orm/mysql-core";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { pgTable, text as pgText } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import * as mysql from "mysql2/promise";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index";
import { expectAuditLogRoundTrip } from "./audit-log-round-trip";

const TEMPLATES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../cli/src/templates",
);

function initSql(dialect: "postgresql" | "mysql" | "sqlite"): string {
  return fs.readFileSync(path.join(TEMPLATES, `migration.${dialect}.sql.txt`), "utf8");
}

function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = isDockerAvailable();

describe("the 0001_init.sql that flowpanel init writes", () => {
  it("applies on SQLite and accepts an audit row", async () => {
    const sqlite = new Database(":memory:");
    const probe = sqliteTable("probe", { id: sqliteText("id").primaryKey() });
    const adapter = drizzleAdapter({ db: drizzleSqlite(sqlite), schema: { probe } });
    await adapter.applyMigration?.("0001_init", initSql("sqlite"));
    sqlite.prepare("INSERT INTO flowpanel_audit_log (action) VALUES ('create')").run();
    const row = sqlite.prepare("SELECT id, at FROM flowpanel_audit_log").get() as {
      id: string;
      at: string;
    };
    expect(row.id).toMatch(/^[0-9a-f]{32}$/);
    expect(row.at).toBeTruthy();
    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_init"]));
    sqlite.prepare("DELETE FROM flowpanel_audit_log").run();
    await expectAuditLogRoundTrip(adapter.auditLog);
    sqlite.close();
  });

  describe.skipIf(!dockerAvailable)("on servers", () => {
    let pg: StartedPostgreSqlContainer | undefined;
    let my: StartedMySqlContainer | undefined;
    afterAll(async () => {
      await pg?.stop();
      await my?.stop();
    }, 120_000);

    it("applies on PostgreSQL", async () => {
      pg = await new PostgreSqlContainer("postgres:16-alpine").start();
      const client = postgres(pg.getConnectionUri(), { onnotice: () => {} });
      const probe = pgTable("probe", { id: pgText("id").primaryKey() });
      const adapter = drizzleAdapter({ db: drizzlePg(client), schema: { probe } });
      await adapter.applyMigration?.("0001_init", initSql("postgresql"));
      await client`INSERT INTO flowpanel_audit_log (action) VALUES ('create')`;
      const [row] = await client`SELECT id FROM flowpanel_audit_log`;
      expect(String(row?.id)).toMatch(/^[0-9a-f-]{36}$/);
      await client`DELETE FROM flowpanel_audit_log`;
      await expectAuditLogRoundTrip(adapter.auditLog);
      await client.end();
    }, 120_000);

    it("applies on MySQL", async () => {
      my = await new MySqlContainer("mysql:8").start();
      const pool = mysql.createPool(my.getConnectionUri());
      const probe = mysqlTable("probe", { id: mysqlVarchar("id", { length: 36 }).primaryKey() });
      const adapter = drizzleAdapter({ db: drizzleMysql(pool), schema: { probe } });
      await adapter.applyMigration?.("0001_init", initSql("mysql"));
      await pool.query("INSERT INTO flowpanel_audit_log (action) VALUES ('create')");
      const [rows] = await pool.query("SELECT id FROM flowpanel_audit_log");
      expect(JSON.stringify(rows)).toMatch(/"id":"[0-9a-f-]{36}"/);
      await pool.query("DELETE FROM flowpanel_audit_log");
      await expectAuditLogRoundTrip(adapter.auditLog);
      await pool.end();
    }, 180_000);
  });
});
