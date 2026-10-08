// LOC-OK: doctor runs its checks in one ordered pass, so the printed order is the documented one.
import * as path from "node:path";
import pc from "picocolors";
import { noOrmMessage } from "../commands/init-output";
import { createFilesystemPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent, FilesystemPlan } from "../plan/types";
import { findAdminConfig } from "../scaffold/config-target";
import {
  type AdminMount,
  findAdminRouteConflicts,
  normalizeAdminPath,
  readAdminMount,
} from "../utils/admin-path";
import { inspectProjectCompatibility } from "../utils/compatibility";
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
import { usesCacheComponents } from "../utils/next-config";
import { configDialect, migrationTemplate } from "../utils/sql-dialect";
import { cacheComponentsChecks } from "./cache-components";
import type { Check } from "./check";
import { type ConfigWarnings, firstLine, readConfigWarnings } from "./config-warnings";
import { countKitInstances, fixPrecondition, staleEjectMarkers } from "./probes";
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
  const nextDeps = "next@^16 react@^19 react-dom@^19";
  const nextVersion = next?.dependency.installed?.version;
  add(
    nextVersion ? `Next.js ${nextVersion} (15.5 or 16)` : "Next.js 15.5 or 16",
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
      ? noOrmMessage(pmc)
      : `Found ${ormFinding?.observed}. Required ${ormFinding?.required}. ${ormFinding?.recovery}`,
  );
  const adminConfig = await findAdminConfig(cwd);
  const initialised = adminConfig !== null;
  add(
    adminConfig ? path.basename(adminConfig.root) : "flowpanel.config.ts",
    initialised,
    `Not set up yet. Run: ${pmc.dlx} @flowpanel/cli init`,
  );
  if (!initialised) return { checks, mount, kitMismatch: null, overlapsGeneratedApi, pmc };
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

  const migrationTemplateName = migrationTemplate((await configDialect(cwd)) ?? "postgresql");
  const cacheComponents = await usesCacheComponents(cwd);
  for (const {
    mount: mountKind,
    relToMount,
    templateName: fileTemplate,
    label,
    needsConfigImport,
    optional,
  } of FIXABLE_FILES) {
    const templateName = mountKind === null ? migrationTemplateName : fileTemplate;
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

    const hint = `Run: ${pmc.exec} flowpanel doctor --fix`;
    const fix = exists
      ? undefined
      : async () => makeFix(relDest, templateName, configImport, cacheComponents);
    if (optional) {
      checks.push({
        name: label,
        ok: true,
        ...(exists ? {} : { warn: true, hint }),
        ...(fix ? { fix } : {}),
      });
    } else add(label, exists, hint, fix);
  }

  checks.push(...(await cacheComponentsChecks(cwd, compatibility, appDir, mount, aliasMode)));

  const probe = async (name: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (e) {
      checks.push({ name, ok: true, warn: true, hint: `Could not check: ${firstLine(e)}` });
    }
  };

  await probe("Single @flowpanel/kit instance", async () => {
    const kitCount = await countKitInstances(cwd);
    if (kitCount === null) return;
    add(
      "Single @flowpanel/kit instance",
      kitCount <= 1,
      kitCount > 1
        ? `Found ${kitCount} active @flowpanel/kit installations. ` +
            `Align FlowPanel versions and peer dependency ranges, then reinstall with your lockfile.`
        : undefined,
    );
  });

  await probe("Ejected admin pages carry the eject marker", async () => {
    const stale = await staleEjectMarkers(cwd, appDir, mount.path ?? "/admin");
    if (stale === null) return;
    add(
      "Ejected admin pages carry the eject marker",
      stale.length === 0,
      stale.length > 0 ? stale.join("\n    ") : undefined,
    );
  });

  return { checks, mount, kitMismatch, overlapsGeneratedApi, pmc };
}

/** The checks that generate Next's types, compile the project and evaluate its config; run once, after any fix. */
async function gatherProjectChecks(
  cwd: string,
  pmc: PmCommands,
): Promise<{ checks: Check[]; config: ConfigWarnings }> {
  const adminConfig = await findAdminConfig(cwd);
  if (adminConfig === null) return { checks: [], config: { warnings: [] } };
  const tsc = await runTsc(cwd, pmc);
  const config = await readConfigWarnings(cwd);
  const checks: Check[] = [
    { name: "tsc --noEmit", ok: tsc.ok, ...(tsc.hint === undefined ? {} : { hint: tsc.hint }) },
    {
      name: `${path.basename(adminConfig.root)} evaluates`,
      ok: !("unreadable" in config),
      ...("unreadable" in config ? { hint: config.unreadable } : {}),
    },
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
      (await fixPrecondition(cwd, gathered.pmc.dlx));
    if (fixBlocked) {
      if (!options.quiet) process.stderr.write(`${pc.red("✗")} --fix refused: ${fixBlocked}\n`);
    } else {
      const fixes = gathered.checks.flatMap((check) =>
        (!check.ok || check.warn) && check.fix ? [check.fix] : [],
      );
      try {
        const intents: FileIntent[] = await Promise.all(fixes.map((fix) => fix()));
        plan = await createFilesystemPlan(cwd, intents);
        if (options.applyFixes !== false) {
          const written = await applyFilesystemPlan(plan);
          if (!options.quiet) {
            for (const file of written) process.stdout.write(`${pc.green("✓")} fixed: ${file}\n`);
          }
          if (written.length > 0) gathered = await gatherFileChecks(cwd, options);
        }
      } catch (e: unknown) {
        if (!options.quiet) {
          process.stderr.write(
            `${pc.red("✗")} fix failed: ${e instanceof Error ? e.message : String(e)}\n`,
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
