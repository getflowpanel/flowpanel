import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, describe, it } from "vitest";
import { prismaAdapter } from "../adapter";
import type { PrismaDmmf } from "../introspect";
import { expectAuditLogRoundTrip } from "./audit-log-round-trip";
import { generatePrismaClient, isDockerAvailable } from "./provider-clients";

const require = createRequire(import.meta.url);
const dmmf: PrismaDmmf = { datamodel: { models: [], enums: [] } };
const TEMPLATES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../cli/src/templates",
);

function initSql(provider: "postgresql" | "sqlite"): string {
  return fs.readFileSync(path.join(TEMPLATES, `migration.${provider}.sql.txt`), "utf8");
}

type Client = { $disconnect(): Promise<void> };

function sqliteClient(): (new (options: unknown) => Client) | null {
  try {
    return require("../../node_modules/.prisma/test-client").PrismaClient;
  } catch {
    return null;
  }
}

const SqliteClient = sqliteClient();

describe.skipIf(SqliteClient === null)("prismaAdapter audit log on SQLite", () => {
  it("writes and reads flowpanel_audit_log after the init migration", async () => {
    if (!SqliteClient) return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-audit-"));
    const prisma = new SqliteClient({
      datasources: { db: { url: `file:${path.join(dir, "audit.db")}` } },
    });
    const adapter = prismaAdapter({ prisma, dmmf, provider: "sqlite" });
    try {
      await adapter.applyMigration?.("0001_audit_init", initSql("sqlite"));
      await expectAuditLogRoundTrip(adapter.auditLog);
    } finally {
      await prisma.$disconnect();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!isDockerAvailable())("prismaAdapter audit log on PostgreSQL", () => {
  let container: StartedPostgreSqlContainer | undefined;
  afterAll(async () => {
    await container?.stop();
  }, 120_000);

  it("writes and reads flowpanel_audit_log after the init migration", async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const PrismaClient = generatePrismaClient("postgres.prisma", "test-client-postgres");
    const prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    try {
      const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });
      await adapter.applyMigration?.("0001_init", initSql("postgresql"));
      await expectAuditLogRoundTrip(adapter.auditLog);
    } finally {
      await prisma.$disconnect?.();
    }
  }, 180_000);
});
