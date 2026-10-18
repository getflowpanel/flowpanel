import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FileIntent } from "../plan/types";
import { migrationTemplate, type SqlDialect } from "./sql-dialect";
import { tpl } from "./template";

const INIT_MIGRATION = "flowpanel/migrations/0001_init.sql";
const AUDIT_MIGRATION = "flowpanel/migrations/0002_audit_log_0_4.sql";

/** What a migrations folder from 0.3 needs before the 0.4 audit log can write, and why. */
export interface AuditUpgrade {
  intent: FileIntent;
  reason: string;
}

/** A 0.3 0001 gets a 0002 with the new columns; its PostgreSQL SQL on MySQL or SQLite is replaced instead. */
export async function auditUpgrade(
  cwd: string,
  dialect: SqlDialect | null,
): Promise<AuditUpgrade | null> {
  const first = await fs.readFile(path.join(cwd, INIT_MIGRATION), "utf8").catch(() => null);
  if (first === null || !first.includes("flowpanel_audit_log") || first.includes("scope_key")) {
    return null;
  }
  if (dialect !== null && dialect !== "postgresql" && first.includes("gen_random_uuid")) {
    return {
      intent: {
        path: INIT_MIGRATION,
        content: await tpl(migrationTemplate(dialect)),
        overwrite: true,
        expectedContent: first,
      },
      reason: `${INIT_MIGRATION} holds the PostgreSQL SQL that 0.3 wrote for every database, and this project uses ${dialect}`,
    };
  }
  const second = await fs.readFile(path.join(cwd, AUDIT_MIGRATION), "utf8").catch(() => null);
  if (second !== null) return null;
  return {
    intent: {
      path: AUDIT_MIGRATION,
      content: await tpl(`migration-audit.${dialect ?? "postgresql"}.sql.txt`),
    },
    reason: `${INIT_MIGRATION} is from 0.3, so flowpanel_audit_log lacks the actor_name, scope_key and diff_preview columns 0.4 writes`,
  };
}

/** The 0002 for a table the database shows without the 0.4 columns, when no 0002 is there to add them. */
export async function auditColumnsUpgrade(
  cwd: string,
  dialect: SqlDialect | null,
): Promise<FileIntent | null> {
  const existing = await fs.readFile(path.join(cwd, AUDIT_MIGRATION), "utf8").catch(() => null);
  if (existing !== null) return null;
  return {
    path: AUDIT_MIGRATION,
    content: await tpl(`migration-audit.${dialect ?? "postgresql"}.sql.txt`),
  };
}
