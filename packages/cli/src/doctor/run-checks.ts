import * as path from "node:path";
import pc from "picocolors";
import { createFilesystemPlan } from "../plan/filesystem-plan";
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
  type PmCommands,
  pmCommands,
} from "../utils/detect";
import { installedKitVersion, kitCompatibilityError, pinnedSpec } from "../utils/kit";
import type { Check } from "./check";
import { type ConfigWarnings, readConfigWarnings } from "./config-warnings";
import { countCoreInstances, fixPrecondition, staleEjectMarkers } from "./probes";
import { FIXABLE_FILES, MIGRATION_REL_DEST, makeFix } from "./templates";
import { runTsc } from "./tsc-check";
import { warningChecks } from "./warnings";

export type { Check };

interface DoctorOptions {
  applyFixes?: boolean;
  quiet?: boolean;
  adminPath?: string;
}

interface Gathered {
  checks: Check[];
  mount: AdminMount;
  kitMismatch: string | null;
  overlapsGeneratedApi: boolean;
  pmc: PmCommands;
}

/** The checks that read files and manifests; cheap enough to repeat after `--fix` writes. */
async function gatherFileChecks(cwd: string, options: DoctorOptions): Promise<Gathered> {
  const pm = await detectPackageManager(cwd);
  const pmc = pmCommands(pm);
  const appDir = await detectAppDir(cwd);
  const aliasMode = await detectPathAlias(cwd);
  const configured = await readAdminMount(cwd);
  const mount: AdminMount = options.adminPath
    ? { path: normalizeAdminPath(options.adminPath), api: configured.api ?? null }
    : configured;
  const apiPath = mount.api ?? null;
  const overlapsGeneratedApi =
    mount.path !== undefined &&
    apiPath !== null &&
    (mount.path === apiPath ||
      mount.path.startsWith(`${apiPath}/`) ||
      apiPath.startsWith(`${mount.path}/`));
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
  const kitInstalled = (await installedKitVersion(cwd)) !== null;
  add(
    "@flowpanel/kit matches this CLI",
    kitInstalled && kitMismatch === null,
    kitInstalled
      ? (kitMismatch ?? undefined)
      : `@flowpanel/kit is not installed. Run: ${pmc.addDisplay(pinnedSpec("@flowpanel/kit"), false)}`,
  );
  add("Admin mount configuration", !mount.error, mount.error);

  for (const {
    mount: mountKind,
    relToMount,
    templateName,
    label,
    needsConfigImport,
  } of FIXABLE_FILES) {
    const isAdmin = mountKind === "admin";
    if (isAdmin && !mount.path) continue;
    // A configured but dynamic `paths.api` names files this run cannot know.
    if (mountKind === "api" && apiPath === null) {
      add(label, false, "paths.api is not a static string; pass its resolved URL to repair it.");
      continue;
    }
    const relDest =
      mountKind === null
        ? MIGRATION_REL_DEST
        : `${appDir}${mountKind === "admin" ? mount.path : apiPath}/${relToMount}`;
    const dest = path.join(cwd, relDest);
    const exists = await fileExists(dest);
    const configImport = needsConfigImport
      ? configImportFor(path.dirname(relDest), aliasMode)
      : null;

    const ownAdminPage = `${appDir}${mount.path}/[[...slug]]/page.tsx`;
    const collisions =
      isAdmin && mount.path
        ? await findAdminRouteConflicts(cwd, appDir, mount.path, ownAdminPage)
        : [];
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

  return { checks, mount, kitMismatch, overlapsGeneratedApi, pmc };
}

/** The checks that generate Next's types, compile the project and evaluate its config; run once, after any fix. */
async function gatherProjectChecks(
  cwd: string,
  pmc: PmCommands,
): Promise<{ checks: Check[]; config: ConfigWarnings }> {
  const tsc = await runTsc(cwd, pmc);
  const config = await readConfigWarnings(cwd);
  const checks: Check[] = [
    { name: "tsc --noEmit", ok: tsc.ok, ...(tsc.hint === undefined ? {} : { hint: tsc.hint }) },
    ...(await warningChecks(cwd, pmc, config)),
  ];
  return { checks, config };
}

export async function runDoctorChecks(
  cwd: string,
  fix: boolean,
  options: DoctorOptions = {},
): Promise<{
  checks: Check[];
  bad: number;
  config: ConfigWarnings;
  plan?: FilesystemPlan;
  fixBlocked?: string;
}> {
  let gathered = await gatherFileChecks(cwd, options);
  const { mount, kitMismatch, overlapsGeneratedApi } = gathered;
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
      const fixable = gathered.checks.filter((check) => !check.ok && check.fix);
      try {
        const intents = await Promise.all(
          fixable.map((check) => check.fix?.() as Promise<FileIntent>),
        );
        plan = await createFilesystemPlan(cwd, intents);
        if (options.applyFixes !== false) {
          const written = await applyFilesystemPlan(plan);
          if (!options.quiet) {
            for (const file of written) process.stdout.write(pc.green(`  ✔ fixed: ${file}\n`));
          }
          if (written.length > 0) gathered = await gatherFileChecks(cwd, options);
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

  const project = await gatherProjectChecks(cwd, gathered.pmc);
  const checks = [...gathered.checks, ...project.checks];
  const { config } = project;
  const bad = checks.filter((check) => !check.ok).length;

  return {
    checks,
    bad,
    config,
    ...(plan ? { plan } : {}),
    ...(fixBlocked ? { fixBlocked } : {}),
  };
}
