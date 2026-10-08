import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findAdminConfig } from "../scaffold/config-target";
import { fileExists, type PmCommands } from "../utils/detect";
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
