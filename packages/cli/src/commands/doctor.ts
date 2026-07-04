import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { hasMarker } from "../eject/marker.js";
import {
  configImportFor,
  detectAppDir,
  detectPackageManager,
  detectPathAlias,
  detectStack,
  fileExists,
  pmCommands,
} from "../utils/detect.js";
import { log } from "../utils/log.js";
import { tpl } from "../utils/template.js";

export async function checkEjectMarker(cwd: string, resourceName: string): Promise<string | null> {
  const appDir = await detectAppDir(cwd);
  const candidate = path.join(cwd, appDir, "admin", resourceName, "page.tsx");
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

const FIXABLE_FILES: ReadonlyArray<{
  relToAppDir: string | null;
  templateName: string;
  label: string;
  needsConfigImport: boolean;
}> = [
  {
    relToAppDir: "api/flowpanel/[...route]/route.ts",
    templateName: "api-route.ts.txt",
    label: "API route",
    needsConfigImport: true,
  },
  {
    relToAppDir: "api/flowpanel/stream/route.ts",
    templateName: "sse-route.ts.txt",
    label: "SSE route",
    needsConfigImport: true,
  },
  {
    relToAppDir: null,
    templateName: "migration.sql.txt",
    label: "Seed migration (flowpanel/migrations)",
    needsConfigImport: false,
  },
  {
    relToAppDir: "admin/[[...slug]]/page.tsx",
    templateName: "admin-page.tsx.txt",
    label: "Catch-all admin page",
    needsConfigImport: true,
  },
];

/** `relToAppDir === null` files (currently just the seed migration) live at a fixed repo-root path. */
const MIGRATION_REL_DEST = "flowpanel/migrations/0001_init.sql";

async function makeFix(
  cwd: string,
  relDest: string,
  templateName: string,
  configImport: string | null,
): Promise<string> {
  const dest = path.join(cwd, relDest);
  const content = configImport
    ? await tpl(templateName, { CONFIG_IMPORT: configImport })
    : await tpl(templateName);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content, "utf8");
  return dest;
}

export async function runDoctorChecks(
  cwd: string,
  fix: boolean,
): Promise<{ checks: Check[]; bad: number }> {
  const stack = await detectStack(cwd);
  const pm = await detectPackageManager(cwd);
  const pmc = pmCommands(pm);
  const appDir = await detectAppDir(cwd);
  const aliasMode = await detectPathAlias(cwd);
  const checks: Check[] = [];

  const add = (name: string, ok: boolean, hint?: string, fixFn?: () => Promise<string>): void => {
    const c: Check = hint === undefined ? { name, ok } : { name, ok, hint };
    if (fixFn) c.fix = fixFn;
    checks.push(c);
  };

  add(
    "Next.js ≥ 15",
    !!stack.nextjsMajor && stack.nextjsMajor >= 15,
    `Upgrade: ${pmc.addDisplay("next@latest react@latest react-dom@latest", false)}`,
  );
  add("TypeScript installed", stack.typescript, `Install: ${pmc.addDisplay("typescript", true)}`);
  add("ORM adapter (Drizzle)", stack.drizzle, `Install: ${pmc.addDisplay("drizzle-orm", false)}`);
  add(
    "flowpanel.config.ts",
    await fileExists(path.join(cwd, "flowpanel.config.ts")),
    "Run: flowpanel init",
  );

  for (const { relToAppDir, templateName, label, needsConfigImport } of FIXABLE_FILES) {
    const relDest = relToAppDir === null ? MIGRATION_REL_DEST : `${appDir}/${relToAppDir}`;
    const dest = path.join(cwd, relDest);
    const exists = await fileExists(dest);
    const configImport = needsConfigImport
      ? configImportFor(path.dirname(relDest), aliasMode)
      : null;

    add(
      label,
      exists,
      "Run: flowpanel doctor --fix",
      exists ? undefined : async () => makeFix(cwd, relDest, templateName, configImport),
    );
  }

  try {
    const coreCount = await countCoreInstances(cwd);
    if (coreCount !== null) {
      add(
        "Single @flowpanel/core instance",
        coreCount <= 1,
        coreCount > 1
          ? `Found ${coreCount} @flowpanel/core copies in node_modules. ` +
              `Pin peers via pnpm.peerDependencyRules.allowedVersions or align peer ranges.`
          : undefined,
      );
    }
  } catch {}

  try {
    const missingConfirm = await findDestructiveWithoutConfirm(cwd);
    add(
      "Destructive actions have confirm",
      missingConfirm.length === 0,
      missingConfirm.length > 0
        ? `Destructive actions without confirm:\n    ${missingConfirm.join("\n    ")}`
        : undefined,
    );
  } catch {}

  const tscCmd = `${pmc.exec} tsc --noEmit`;
  try {
    execSync(tscCmd, { cwd, stdio: "ignore" });
    add("tsc --noEmit", true);
  } catch {
    add("tsc --noEmit", false, `TypeScript errors in project. Run: ${tscCmd}`);
  }

  if (fix) {
    for (const check of checks) {
      if (!check.ok && check.fix) {
        try {
          const written = await check.fix();
          process.stdout.write(pc.green(`  ✔ fixed: ${written}\n`));
          check.ok = await fileExists(written);
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

/**
 * Counts `@flowpanel/core` copies in pnpm's store. `null` means the layout this
 * reads does not exist, so the check is skipped rather than reported as passing.
 */
async function countCoreInstances(cwd: string): Promise<number | null> {
  const pnpmDir = path.join(cwd, "node_modules", ".pnpm");
  let entries: string[];
  try {
    entries = await fs.readdir(pnpmDir);
  } catch {
    return null;
  }
  return entries.filter((name) => name.startsWith("@flowpanel+core@")).length;
}

/** Best-effort static scan of admin config files for destructive actions that lack a `confirm`. */
async function findDestructiveWithoutConfirm(cwd: string): Promise<string[]> {
  const candidates = [
    "flowpanel.config.ts",
    "src/admin/flowpanel.config.ts",
    "src/flowpanel.config.ts",
  ];
  const misses: string[] = [];
  for (const rel of candidates) {
    const abs = path.join(cwd, rel);
    let src: string;
    try {
      src = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line?.includes(`variant: "destructive"`)) continue;
      const slice = lines.slice(i, Math.min(i + 10, lines.length)).join("\n");
      if (!slice.includes("confirm:")) {
        misses.push(`${rel}:${i + 1}`);
      }
    }
  }
  return misses;
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
