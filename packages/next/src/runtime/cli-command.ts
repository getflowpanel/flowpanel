import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RUNNERS = new Map([
  ["pnpm", "pnpm"],
  ["yarn", "yarn"],
  ["bun", "bunx"],
  ["npm", "npx"],
]);

const LOCKFILES = [
  ["pnpm", "pnpm-lock.yaml"],
  ["yarn", "yarn.lock"],
  ["bun", "bun.lockb"],
  ["bun", "bun.lock"],
  ["npm", "package-lock.json"],
] as const;

function declaredManager(cwd: string): string | null {
  try {
    const manifest = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
      packageManager?: unknown;
    };
    return typeof manifest.packageManager === "string"
      ? (manifest.packageManager.split("@")[0] ?? null)
      : null;
  } catch {
    return null;
  }
}

/** The project's package manager as `flowpanel` detects it: `packageManager`, then its one lockfile, then the agent that started this server. */
function projectManager(cwd: string): string {
  const declared = declaredManager(cwd);
  if (declared && RUNNERS.has(declared)) return declared;
  const locked = new Set<string>(
    LOCKFILES.flatMap(([manager, file]) => (existsSync(join(cwd, file)) ? [manager] : [])),
  );
  if (locked.size === 1) return [...locked][0] ?? "npm";
  const agent = (process.env.npm_config_user_agent ?? "").split("/")[0] ?? "";
  if (RUNNERS.has(agent) && (locked.size === 0 || locked.has(agent))) return agent;
  return "npm";
}

/** The flowpanel CLI command as this project's package manager runs it, such as `pnpm flowpanel new <table>`. */
export function cliCommand(args: string, cwd = process.cwd()): string {
  return `${RUNNERS.get(projectManager(cwd)) ?? "npx"} flowpanel ${args}`;
}
