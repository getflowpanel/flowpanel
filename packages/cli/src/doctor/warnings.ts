import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileExists, type PmCommands } from "../utils/detect";
import type { Check } from "./check";
import type { ConfigWarnings } from "./config-warnings";
import { findSessionStub, type SessionStub } from "./session-module";

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
  if (sessionStub !== null || (await fileExists(path.join(cwd, "flowpanel.config.ts")))) {
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

  return checks;
}
