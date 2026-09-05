import { execFileSync } from "node:child_process";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  countCoreInstances,
  firstDiagnostics,
  fixPrecondition,
  staleEjectMarkers,
} from "../doctor/probes";
import { FIXABLE_FILES, MIGRATION_REL_DEST, makeFix } from "../doctor/templates";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent, FilesystemPlan } from "../plan/types";
import {
  type AdminMount,
  findAdminRouteConflicts,
  normalizeAdminPath,
  readAdminMount,
} from "../utils/admin-path";
import { inspectProjectCompatibility } from "../utils/compatibility";
import { findDestructiveWithoutConfirm } from "../utils/config-scan";
import {
  configImportFor,
  detectAppDir,
  detectPackageManager,
  detectPathAlias,
  fileExists,
  pmCommands,
} from "../utils/detect";
import { kitCompatibilityError } from "../utils/kit";
import { log } from "../utils/log";
import { writeJson } from "../utils/output";
import { inspectDependency } from "../utils/project-packages";

export interface Check {
  name: string;
  ok: boolean;
  hint?: string;
  /** If present, this check is auto-fixable. Returns the intended write. */
  fix?: () => Promise<FileIntent>;
}

export async function runDoctorChecks(
  cwd: string,
  fix: boolean,
  options: { applyFixes?: boolean; quiet?: boolean; adminPath?: string } = {},
): Promise<{ checks: Check[]; bad: number; plan?: FilesystemPlan; fixBlocked?: string }> {
  const pm = await detectPackageManager(cwd);
  const pmc = pmCommands(pm);
  const appDir = await detectAppDir(cwd);
  const aliasMode = await detectPathAlias(cwd);
  const mount: AdminMount = options.adminPath
    ? { path: normalizeAdminPath(options.adminPath) }
    : await readAdminMount(cwd);
  const overlapsGeneratedApi =
    mount.path &&
    (mount.path === "/api/flowpanel" ||
      mount.path.startsWith("/api/flowpanel/") ||
      "/api/flowpanel".startsWith(`${mount.path}/`));
  const checks: Check[] = [];
  const compatibilityReport = await inspectProjectCompatibility(cwd);
  const compatibility = compatibilityReport.findings;
  const compatible = (name: string) => compatibility.find((finding) => finding.name === name);

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

  const next = compatible("next");
  const react = compatible("react");
  const reactDom = compatible("react-dom");
  const reactPair = compatible("React and React DOM versions match");
  const typescript = compatible("typescript");
  const node = compatible("Node.js");
  const nextDeps = "next@^16.3.0 react@^19 react-dom@^19";
  add(
    "Next.js ≥ 16.3 < 17",
    next?.ok ?? false,
    next?.dependency.declaration === null
      ? `Next.js is not in package.json. Install: ${pmc.addDisplay(nextDeps, false)}`
      : `Found ${next?.observed}. Required ${next?.required}. ${next?.recovery}`,
  );
  add("React 19 installed", react?.ok ?? false, react?.recovery);
  add("React DOM 19 installed", reactDom?.ok ?? false, reactDom?.recovery);
  add("React and React DOM versions match", reactPair?.ok ?? false, reactPair?.recovery);
  add("Node.js supported", node?.ok ?? false, node?.recovery);
  add(
    "TypeScript installed",
    typescript?.ok ?? false,
    `Install: ${pmc.addDisplay("typescript", true)}`,
  );
  const ormFinding = compatibilityReport.ormFinding;
  const orm =
    compatibilityReport.orm === "drizzle"
      ? "Drizzle"
      : compatibilityReport.orm === "prisma"
        ? "Prisma"
        : null;
  add(
    orm === null ? "ORM adapter (Drizzle or Prisma)" : `ORM adapter (${orm})`,
    ormFinding?.ok ?? false,
    orm === null
      ? `Install one: ${pmc.addDisplay("drizzle-orm", false)} or ${pmc.addDisplay("@prisma/client", false)}`
      : `Found ${ormFinding?.observed}. Required ${ormFinding?.required}. ${ormFinding?.recovery}`,
  );
  add(
    "flowpanel.config.ts",
    await fileExists(path.join(cwd, "flowpanel.config.ts")),
    "Run: flowpanel init",
  );
  const kitMismatch = await kitCompatibilityError(cwd);
  add("@flowpanel/kit matches this CLI", kitMismatch === null, kitMismatch ?? undefined);
  add("Admin mount configuration", !mount.error, mount.error);

  for (const { relToAppDir, templateName, label, needsConfigImport } of FIXABLE_FILES) {
    const isAdmin = templateName === "admin-page.tsx.txt";
    if (isAdmin && !mount.path) continue;
    const relDest =
      relToAppDir === null
        ? MIGRATION_REL_DEST
        : isAdmin
          ? `${appDir}${mount.path}/[[...slug]]/page.tsx`
          : `${appDir}/${relToAppDir}`;
    const dest = path.join(cwd, relDest);
    const exists = await fileExists(dest);
    const configImport = needsConfigImport
      ? configImportFor(path.dirname(relDest), aliasMode)
      : null;

    const collisions =
      isAdmin && mount.path ? await findAdminRouteConflicts(cwd, appDir, mount.path, relDest) : [];
    if (collisions.length) {
      add(
        label,
        false,
        `Route overlaps ${collisions.join(", ")}. Choose a free mount; automatic repair is unsafe.`,
      );
      continue;
    }

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
          ? `Found ${coreCount} active @flowpanel/core installations. ` +
              `Align FlowPanel versions and peer dependency ranges, then reinstall with your lockfile.`
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

  const tsc = await inspectDependency(cwd, "typescript");
  const tscBin = tsc.installed?.manifest.bin;
  const tscEntry =
    typeof tscBin === "string" ? tscBin : typeof tscBin?.tsc === "string" ? tscBin.tsc : null;
  if (!tsc.installed || !tscEntry) {
    add("tsc --noEmit", false, "TypeScript is not installed with a tsc binary in this project.");
  } else
    try {
      const absoluteBin = path.resolve(tsc.installed.directory, tscEntry);
      execFileSync(process.execPath, [absoluteBin, "--noEmit"], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
      add("tsc --noEmit", true);
    } catch (e: unknown) {
      const diagnostics = firstDiagnostics(e);
      add(
        "tsc --noEmit",
        false,
        diagnostics
          ? `${diagnostics}\n    Full list: ${[pmc.exec, ...pmc.execArgs("tsc", ["--noEmit"])].join(" ")}`
          : "TypeScript errors in project.",
      );
    }

  let plan: FilesystemPlan | undefined;
  let fixBlocked: string | undefined;
  if (fix) {
    fixBlocked =
      kitMismatch ??
      mount.error ??
      (overlapsGeneratedApi
        ? "Admin mount overlaps the generated API routes; automatic repair is unsafe."
        : undefined) ??
      (await fixPrecondition(cwd));
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
    .option("--path <url>", "Resolved admin URL when the config uses a dynamic path")
    .action(async (opts: { fix?: boolean; dryRun?: boolean; json?: boolean; path?: string }) => {
      const cwd = process.cwd();
      const { checks, bad, plan, fixBlocked } = await runDoctorChecks(cwd, opts.fix ?? false, {
        applyFixes: !opts.dryRun,
        quiet: opts.json ?? false,
        ...(opts.path ? { adminPath: opts.path } : {}),
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
