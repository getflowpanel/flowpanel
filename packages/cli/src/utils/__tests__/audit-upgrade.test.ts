import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditUpgrade } from "../audit-upgrade";
import { migrationTemplate } from "../sql-dialect";
import { tpl } from "../template";

const INIT_0_3 = `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flowpanel_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  action text NOT NULL,
  resource text,
  target_id text,
  diff jsonb,
  ip text,
  user_agent text,
  at timestamptz NOT NULL DEFAULT now()
);
`;

const HAND_MADE_SQLITE_0_3 = `CREATE TABLE IF NOT EXISTS flowpanel_audit_log (
  id text PRIMARY KEY,
  action text NOT NULL,
  at text NOT NULL
);
`;

const dirs: string[] = [];

async function project(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fp-audit-upgrade-"));
  dirs.push(dir);
  for (const [file, contents] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), contents);
  }
  return dir;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});

const INIT = "flowpanel/migrations/0001_init.sql";
const AUDIT = "flowpanel/migrations/0002_audit_log_0_4.sql";

describe("auditUpgrade", () => {
  it("adds a 0002 beside the PostgreSQL 0001 that 0.3 wrote", async () => {
    const dir = await project({ [INIT]: INIT_0_3 });
    const upgrade = await auditUpgrade(dir, "postgresql");
    expect(upgrade?.intent).toEqual({
      path: AUDIT,
      content: await tpl("migration-audit.postgresql.sql.txt"),
    });
    expect(upgrade?.reason).toContain("lacks the actor_name and scope_key columns");
  });

  it("adds the PostgreSQL 0002 when the database cannot be told from the config", async () => {
    const dir = await project({ [INIT]: INIT_0_3 });
    expect((await auditUpgrade(dir, null))?.intent.path).toBe(AUDIT);
  });

  it("leaves a 0.4 0001 alone on every database", async () => {
    for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
      const dir = await project({ [INIT]: await tpl(migrationTemplate(dialect)) });
      expect(await auditUpgrade(dir, dialect)).toBeNull();
    }
  });

  it("replaces the PostgreSQL 0001 on SQLite and MySQL, where it never ran", async () => {
    for (const dialect of ["sqlite", "mysql"] as const) {
      const dir = await project({ [INIT]: INIT_0_3 });
      const upgrade = await auditUpgrade(dir, dialect);
      expect(upgrade?.intent).toEqual({
        path: INIT,
        content: await tpl(migrationTemplate(dialect)),
        overwrite: true,
        expectedContent: INIT_0_3,
      });
      expect(upgrade?.reason).toContain(`this project uses ${dialect}`);
    }
  });

  it("adds the dialect's 0002 beside a 0001 the developer rewrote for SQLite", async () => {
    const dir = await project({ [INIT]: HAND_MADE_SQLITE_0_3 });
    expect((await auditUpgrade(dir, "sqlite"))?.intent).toEqual({
      path: AUDIT,
      content: await tpl("migration-audit.sqlite.sql.txt"),
    });
  });

  it("writes nothing once the 0002 exists", async () => {
    const dir = await project({ [INIT]: INIT_0_3, [AUDIT]: "-- applied\n" });
    expect(await auditUpgrade(dir, "postgresql")).toBeNull();
  });

  it("ignores a project without migrations and a 0001 that has no audit table", async () => {
    expect(await auditUpgrade(await project({}), "postgresql")).toBeNull();
    expect(await auditUpgrade(await project({ [INIT]: "select 1;" }), "postgresql")).toBeNull();
  });
});
