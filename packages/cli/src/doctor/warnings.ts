import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findAdminConfig } from "../scaffold/config-target";
import { auditColumnsUpgrade, auditUpgrade } from "../utils/audit-upgrade";
import { fileExists, type PmCommands } from "../utils/detect";
import { configDialect } from "../utils/sql-dialect";
import type { Check } from "./check";
import type { ConfigWarnings } from "./config-warnings";
import { findSessionStub, type SessionStub } from "./session-module";

const ESLINT_PLUGIN_DOCS = "https://flowpanel.tech/docs/reference/eslint-plugin";
const ESLINT_CONFIGS = ["js", "mjs", "cjs", "ts", "mts", "cts"].map(
  (ext) => `eslint.config.${ext}`,
);

/** Whether a flat ESLint config in the project or above it, up to the repository root, loads the plugin. */
async function usesFlowpanelEslintPlugin(cwd: string): Promise<boolean> {
  for (let dir = cwd; ; dir = path.dirname(dir)) {
    for (const name of ESLINT_CONFIGS) {
      const source = await fs.readFile(path.join(dir, name), "utf8").catch(() => "");
      if (source.includes("@flowpanel/eslint-plugin")) return true;
    }
    const top = await Promise.all(
      [".git", "pnpm-workspace.yaml"].map((marker) => fileExists(path.join(dir, marker))),
    );
    if (top.includes(true) || path.dirname(dir) === dir) return false;
  }
}

function warning(name: string, warn: boolean, hint: string): Check {
  return { name, ok: true, ...(warn ? { warn: true, hint } : {}) };
}

function sessionHint({ file, kind }: SessionStub, pmc: PmCommands): string {
  return kind === "development"
    ? `${file} signs every request in as an admin in development and throws under \`next start\`. Replace it with your auth provider before deploying.`
    : `${file} is still the closed stub, so the admin denies every request. Return your provider's session from getSession there, or run \`${pmc.exec} flowpanel init --dev-auth\` for an open development identity.`;
}

/** Checks that never fail the run: the project works, but the admin will not be usable yet. */
export async function warningChecks(
  cwd: string,
  pmc: PmCommands,
  config: ConfigWarnings,
): Promise<Check[]> {
  const checks: Check[] = [];

  const sessionStub = await findSessionStub(cwd);
  if (sessionStub !== null || (await findAdminConfig(cwd)) !== null) {
    checks.push(
      warning(
        "Session module",
        sessionStub !== null,
        sessionStub === null ? "" : sessionHint(sessionStub, pmc),
      ),
    );
  }

  if ("resourceCount" in config && config.resourceCount !== undefined) {
    checks.push(
      warning(
        "Resources configured",
        config.resourceCount === 0,
        `resources is empty. Run \`${pmc.exec} flowpanel new <table>\` to add one.`,
      ),
    );
  }

  const missing = "missingTables" in config ? (config.missingTables ?? []) : [];
  if (missing.length > 0) {
    const one = missing.length === 1;
    checks.push(
      warning(
        "Resource tables",
        true,
        `${missing.join(", ")} ${one ? "has" : "have"} no table in the database DATABASE_URL points at, so ${one ? "its list shows" : "their lists show"} "Couldn't load". Create ${one ? "it" : "them"} with your migrations, such as \`${pmc.exec} drizzle-kit push\` or \`${pmc.exec} prisma db push\`.`,
      ),
    );
  }

  const dialect = await configDialect(cwd);
  const upgrade = await auditUpgrade(cwd, dialect);
  const auditTable = "auditTable" in config ? config.auditTable : undefined;
  const columns =
    !upgrade && auditTable === "columns" ? await auditColumnsUpgrade(cwd, dialect) : null;
  if (upgrade || auditTable) {
    const intent = upgrade?.intent ?? columns;
    const lacks =
      "lacks the actor_name and scope_key columns 0.4 writes, so audit events fail to save";
    checks.push({
      name: "Audit log table",
      ok: true,
      warn: true,
      hint: upgrade
        ? `${upgrade.reason}. Run \`${pmc.exec} flowpanel migrate\`, which writes ${upgrade.intent.path} and applies it.`
        : columns
          ? `flowpanel_audit_log ${lacks}. Run \`${pmc.exec} flowpanel doctor --fix\`, which writes ${columns.path}, then \`${pmc.exec} flowpanel migrate\`.`
          : `flowpanel_audit_log ${auditTable === "table" ? "does not exist, so audit events fail to save" : lacks}. Run \`${pmc.exec} flowpanel migrate\`.`,
      ...(intent ? { fix: async () => intent } : {}),
    });
  }

  const migrations = await fs
    .readdir(path.join(cwd, "flowpanel/migrations"))
    .catch(() => [] as string[]);
  if (migrations.some((file) => file.endsWith(".sql"))) {
    checks.push(
      warning(
        "DATABASE_URL set",
        !process.env.DATABASE_URL,
        `flowpanel/migrations has SQL files and DATABASE_URL is not set. Add it to .env.local, then run \`${pmc.exec} flowpanel migrate\`.`,
      ),
    );
  }

  if (!(await usesFlowpanelEslintPlugin(cwd))) {
    checks.push({
      name: "ESLint plugin",
      ok: true,
      info: true,
      hint: `Add @flowpanel/eslint-plugin to your ESLint config to catch a destructive action without confirm: ${ESLINT_PLUGIN_DOCS}`,
    });
  }

  return checks;
}
