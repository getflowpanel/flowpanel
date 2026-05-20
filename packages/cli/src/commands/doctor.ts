import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { hasMarker } from "../eject/marker.js";
import { loadTemplate } from "../utils/template.js";
import { detectStack, fileExists } from "../utils/detect.js";
import { log } from "../utils/log.js";

export async function checkEjectMarker(cwd: string, resourceName: string): Promise<string | null> {
  const candidate = path.join(cwd, "app/admin", resourceName, "page.tsx");
  try {
    const src = await fs.readFile(candidate, "utf8");
    if (!hasMarker(src)) {
      return (
        `${path.relative(cwd, candidate)} exists but lacks the eject marker. ` +
        `If this file is hand-written, that's fine; if it was meant to be ejected, ` +
        `re-run \`flowpanel eject resource ${resourceName}\` (or add the marker manually).`
      );
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
  }
  return null;
}

export interface Check {
  name: string;
  ok: boolean;
  hint?: string;
  /** If present, this check is auto-fixable. Returns the path written. */
  fix?: () => Promise<string>;
}

/** Auto-fixable file checks: dest → template name */
const FIXABLE_FILES: ReadonlyArray<readonly [relDest: string, templateName: string]> = [
  ["app/api/flowpanel/[...route]/route.ts", "api-route.ts.txt"],
  ["app/api/flowpanel/stream/route.ts", "sse-route.ts.txt"],
  ["flowpanel/migrations/0001_init.sql", "migration.sql.txt"],
  ["app/admin/[[...slug]]/page.tsx", "admin-page.tsx.txt"],
];

async function makeFix(cwd: string, relDest: string, templateName: string): Promise<string> {
  const dest = path.join(cwd, relDest);
  const content = await loadTemplate(templateName);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content, "utf8");
  return dest;
}

export async function runDoctorChecks(
  cwd: string,
  fix: boolean,
): Promise<{ checks: Check[]; bad: number }> {
  const stack = await detectStack(cwd);
  const checks: Check[] = [];

  const add = (name: string, ok: boolean, hint?: string, fixFn?: () => Promise<string>): void => {
    const c: Check = hint === undefined ? { name, ok } : { name, ok, hint };
    if (fixFn) c.fix = fixFn;
    checks.push(c);
  };

  add(
    "Next.js ≥ 15",
    !!stack.nextjsMajor && stack.nextjsMajor >= 15,
    "Upgrade: pnpm add next@latest react@latest react-dom@latest",
  );
  add("TypeScript installed", stack.typescript, "Install: pnpm add -D typescript");
  add("ORM adapter (Drizzle)", stack.drizzle, "Install: pnpm add drizzle-orm");
  add(
    "flowpanel.config.ts",
    await fileExists(path.join(cwd, "flowpanel.config.ts")),
    "Run: flowpanel init",
    // not auto-fixable — requires user input
  );

  // Auto-fixable file checks
  for (const [relDest, templateName] of FIXABLE_FILES) {
    const dest = path.join(cwd, relDest);
    const exists = await fileExists(dest);
    const label =
      relDest === "app/api/flowpanel/[...route]/route.ts"
        ? "API route"
        : relDest === "app/api/flowpanel/stream/route.ts"
          ? "SSE route"
          : relDest === "flowpanel/migrations/0001_init.sql"
            ? "flowpanel/migrations directory"
            : "Catch-all admin page";

    add(
      label,
      exists,
      "Run: flowpanel doctor --fix",
      exists ? undefined : async () => makeFix(cwd, relDest, templateName),
    );
  }

  add(
    "flowpanel/migrations directory",
    await fileExists(path.join(cwd, "flowpanel", "migrations")),
    "Run: flowpanel doctor --fix",
    // covered by migration.sql.txt fix above (mkdir recursive), but keep the check
  );

  try {
    execSync("pnpm exec tsc --noEmit", { cwd, stdio: "ignore" });
    add("tsc --noEmit", true);
  } catch {
    add("tsc --noEmit", false, "TypeScript errors in project. Run: pnpm exec tsc --noEmit");
  }

  // Apply fixes before computing bad count
  if (fix) {
    for (const check of checks) {
      if (!check.ok && check.fix) {
        try {
          const written = await check.fix();
          process.stdout.write(pc.green(`  ✔ fixed: ${written}\n`));
          // Re-evaluate
          const relDest = FIXABLE_FILES.find(([, t]) => {
            const label =
              check.name === "API route"
                ? "api-route.ts.txt"
                : check.name === "SSE route"
                  ? "sse-route.ts.txt"
                  : check.name === "Catch-all admin page"
                    ? "admin-page.tsx.txt"
                    : "migration.sql.txt";
            return t === label;
          })?.[0];
          if (relDest) {
            check.ok = await fileExists(path.join(cwd, relDest));
          } else {
            check.ok = true;
          }
        } catch (e: unknown) {
          process.stderr.write(
            pc.red(
              `  ✘ fix failed for "${check.name}": ${e instanceof Error ? e.message : String(e)}\n`,
            ),
          );
        }
      }
    }
  }

  let bad = 0;
  for (const r of checks) {
    if (!r.ok) bad++;
  }

  return { checks, bad };
}

export function doctorCommand(cli: Command): void {
  cli
    .command("doctor")
    .description("Check FlowPanel health and wiring")
    .option("--fix", "Auto-fix missing route files from templates")
    .action(async (opts: { fix?: boolean }) => {
      const cwd = process.cwd();
      const { checks, bad } = await runDoctorChecks(cwd, opts.fix ?? false);

      for (const r of checks) {
        if (r.ok) log.ok(r.name);
        else {
          log.err(r.name);
          if (r.hint) process.stdout.write(`    ${pc.dim(r.hint)}\n`);
        }
      }

      process.stdout.write("\n");
      if (bad === 0) log.ok(pc.bold("All checks passed."));
      else log.err(pc.bold(`${bad} issue${bad === 1 ? "" : "s"} found.`));
      process.exit(bad === 0 ? 0 : 1);
    });
}
