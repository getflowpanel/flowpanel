import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { hasMarker } from "../eject/marker.js";
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

interface Check {
  name: string;
  ok: boolean;
  hint?: string;
}

export function doctorCommand(cli: Command): void {
  cli
    .command("doctor")
    .description("Check FlowPanel health and wiring")
    .action(async () => {
      const cwd = process.cwd();
      const stack = await detectStack(cwd);
      const checks: Check[] = [];
      const add = (name: string, ok: boolean, hint?: string): void => {
        checks.push(hint === undefined ? { name, ok } : { name, ok, hint });
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
        "Run: pnpm dlx flowpanel init",
      );
      add(
        "Catch-all admin page",
        await fileExists(path.join(cwd, "app/admin/[[...slug]]/page.tsx")),
        "Run: pnpm dlx flowpanel init",
      );
      add(
        "API route",
        await fileExists(path.join(cwd, "app/api/flowpanel/[...route]/route.ts")),
        "Run: pnpm dlx flowpanel init",
      );
      add(
        "SSE route",
        await fileExists(path.join(cwd, "app/api/flowpanel/stream/route.ts")),
        "Run: pnpm dlx flowpanel init",
      );
      add(
        "flowpanel/migrations directory",
        await fileExists(path.join(cwd, "flowpanel", "migrations")),
        "Run: pnpm dlx flowpanel init",
      );

      try {
        execSync("pnpm exec tsc --noEmit", { cwd, stdio: "ignore" });
        add("tsc --noEmit", true);
      } catch {
        add("tsc --noEmit", false, "TypeScript errors in project. Run: pnpm exec tsc --noEmit");
      }

      let bad = 0;
      for (const r of checks) {
        if (r.ok) log.ok(r.name);
        else {
          log.err(r.name);
          if (r.hint) process.stdout.write(`    ${pc.dim(r.hint)}\n`);
          bad++;
        }
      }

      process.stdout.write("\n");
      if (bad === 0) log.ok(pc.bold("All checks passed."));
      else log.err(pc.bold(`${bad} issue${bad === 1 ? "" : "s"} found.`));
      process.exit(bad === 0 ? 0 : 1);
    });
}
