import { execSync } from "node:child_process";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  countCoreInstances,
  firstDiagnostics,
  fixPrecondition,
  staleEjectMarkers,
} from "../doctor/probes";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent, FilesystemPlan } from "../plan/types";
import { findDestructiveWithoutConfirm } from "../utils/config-scan";
import {
  configImportFor,
  detectAppDir,
  detectPackageManager,
  detectPathAlias,
  detectStack,
  fileExists,
  isSupportedNextVersion,
  pmCommands,
} from "../utils/detect";
import { kitCompatibilityError } from "../utils/kit";
import { log } from "../utils/log";
import { writeJson } from "../utils/output";
import { tpl } from "../utils/template";

export interface Check {
  name: string;
  ok: boolean;
  hint?: string;
  /** If present, this check is auto-fixable. Returns the intended write. */
  fix?: () => Promise<FileIntent>;
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
  relDest: string,
  templateName: string,
  configImport: string | null,
): Promise<FileIntent> {
  const content = configImport
    ? await tpl(templateName, { CONFIG_IMPORT: configImport })
    : await tpl(templateName);
  return { path: relDest, content };
}

export async function runDoctorChecks(
  cwd: string,
  fix: boolean,
  options: { applyFixes?: boolean; quiet?: boolean } = {},
): Promise<{ checks: Check[]; bad: number; plan?: FilesystemPlan; fixBlocked?: string }> {
  const stack = await detectStack(cwd);
  const pm = await detectPackageManager(cwd);
  const pmc = pmCommands(pm);
  const appDir = await detectAppDir(cwd);
  const aliasMode = await detectPathAlias(cwd);
  const checks: Check[] = [];

  const add = (
    name: string,
    ok: boolean,
    hint?: string,
    fixFn?: () => Promise<FileIntent>,
  ): void => {
    const c: Check = hint === undefined ? { name, ok } : { name, ok, hint };
    if (fixFn) c.fix = fixFn;
    checks.push(c);
  };

  const nextDeps = "next@^16.3.0 react@^19 react-dom@^19";
  add(
    "Next.js ≥ 16.3 < 17",
    isSupportedNextVersion(stack.nextjs),
    stack.nextjs === null
      ? `Next.js is not in package.json. Install: ${pmc.addDisplay(nextDeps, false)}`
      : `Upgrade: ${pmc.addDisplay(nextDeps, false)}`,
  );
  add("TypeScript installed", stack.typescript, `Install: ${pmc.addDisplay("typescript", true)}`);
  const orm = stack.drizzle ? "Drizzle" : stack.prisma ? "Prisma" : null;
  add(
    orm === null ? "ORM adapter (Drizzle or Prisma)" : `ORM adapter (${orm})`,
    orm !== null,
    `Install one: ${pmc.addDisplay("drizzle-orm", false)} or ${pmc.addDisplay("@prisma/client", false)}`,
  );
  add(
    "flowpanel.config.ts",
    await fileExists(path.join(cwd, "flowpanel.config.ts")),
    "Run: flowpanel init",
  );
  const kitMismatch = await kitCompatibilityError(cwd);
  add("@flowpanel/kit matches this CLI", kitMismatch === null, kitMismatch ?? undefined);

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
      exists ? undefined : async () => makeFix(relDest, templateName, configImport),
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
    const stale = await staleEjectMarkers(cwd, appDir);
    if (stale !== null) {
      add(
        "Ejected admin pages carry the eject marker",
        stale.length === 0,
        stale.length > 0 ? stale.join("\n    ") : undefined,
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
    execSync(tscCmd, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    add("tsc --noEmit", true);
  } catch (e: unknown) {
    const diagnostics = firstDiagnostics(e);
    add(
      "tsc --noEmit",
      false,
      diagnostics
        ? `${diagnostics}\n    Run for the full list: ${tscCmd}`
        : `TypeScript errors in project. Run: ${tscCmd}`,
    );
  }

  let plan: FilesystemPlan | undefined;
  let fixBlocked: string | undefined;
  if (fix) {
    fixBlocked = kitMismatch ?? (await fixPrecondition(cwd));
    if (fixBlocked) {
      if (!options.quiet) process.stderr.write(pc.red(`  ✘ --fix refused: ${fixBlocked}\n`));
    } else {
      const fixable = checks.filter((check) => !check.ok && check.fix);
      try {
        const intents = await Promise.all(
          fixable.map((check) => check.fix?.() as Promise<FileIntent>),
        );
        plan = await createFilesystemPlan(cwd, intents);
        if (options.applyFixes !== false) {
          const written = await applyFilesystemPlan(plan);
          for (const check of fixable) check.ok = true;
          if (!options.quiet) {
            for (const file of written) process.stdout.write(pc.green(`  ✔ fixed: ${file}\n`));
          }
        }
      } catch (e: unknown) {
        if (!options.quiet) {
          process.stderr.write(
            pc.red(`  ✘ fix failed: ${e instanceof Error ? e.message : String(e)}\n`),
          );
        }
      }
    }
  }

  let bad = 0;
  for (const r of checks) {
    if (!r.ok) bad++;
  }

  return { checks, bad, ...(plan ? { plan } : {}), ...(fixBlocked ? { fixBlocked } : {}) };
}

export function doctorCommand(cli: Command): void {
  cli
    .command("doctor")
    .description("Check FlowPanel health and wiring")
    .option("--fix", "Auto-fix missing route files from templates")
    .option("--dry-run", "Show fixes without writing (use with --fix)")
    .option("--json", "Emit machine-readable JSON")
    .action(async (opts: { fix?: boolean; dryRun?: boolean; json?: boolean }) => {
      const cwd = process.cwd();
      const { checks, bad, plan, fixBlocked } = await runDoctorChecks(cwd, opts.fix ?? false, {
        applyFixes: !opts.dryRun,
        quiet: opts.json ?? false,
      });

      if (opts.json) {
        writeJson({
          command: "doctor",
          ok: bad === 0,
          checks: checks.map(({ name, ok, hint }) => ({ name, ok, ...(hint ? { hint } : {}) })),
          ...(plan ? { fixes: publicPlan(plan), applied: !opts.dryRun } : {}),
          ...(fixBlocked ? { fixBlocked } : {}),
        });
        process.exit(bad === 0 ? 0 : 1);
      }

      for (const r of checks) {
        if (r.ok) log.ok(r.name);
        else {
          log.err(r.name);
          if (r.hint) process.stdout.write(`    ${pc.dim(r.hint)}\n`);
        }
      }

      if (plan && opts.dryRun) {
        process.stdout.write(`\n${pc.bold("Fixes (dry run — nothing written):")}\n`);
        for (const operation of publicPlan(plan).operations) {
          process.stdout.write(`  ${operation.kind.padEnd(6)} ${operation.path}\n`);
        }
      }

      process.stdout.write("\n");
      if (bad === 0) log.ok(pc.bold("All checks passed."));
      else log.err(pc.bold(`${bad} issue${bad === 1 ? "" : "s"} found.`));
      process.exit(bad === 0 ? 0 : 1);
    });
}
