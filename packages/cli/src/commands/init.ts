// LOC-OK: one transactional scaffold flow; prompting, planning and installation order stay explicit.
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent } from "../plan/types";
import { findAdminRouteConflicts, normalizeAdminPath, readAdminMount } from "../utils/admin-path";
import { firstCompatibilityFailure, inspectProjectCompatibility } from "../utils/compatibility";
import {
  aliasOf,
  configImportFor,
  detectAppDir,
  detectAuth,
  detectDbClient,
  detectPackageManagerDetails,
  detectPathAlias,
  detectSchema,
  fileExists,
  type PathAliasMode,
  pmCommands,
} from "../utils/detect";
import { redactDiagnostic } from "../utils/fail";
import { kitCompatibilityError, pinnedSpec } from "../utils/kit";
import { validateProjectImport } from "../utils/module-path";
import { writeJson, writePlanJson } from "../utils/output";
import { inspectDependency } from "../utils/project-packages";
import { tpl } from "../utils/template";
import {
  type DependencyRequirement,
  dependencyReport,
  type InstallAttempt,
  inspectRequirements,
  installMissing,
  missingDependencies,
} from "./init-dependencies";
import { findAppLayout } from "./init-layout";

interface InitOptions {
  yes?: boolean;
  dryRun?: boolean;
  json?: boolean;
  path?: string;
  db?: string;
  schema?: string;
  auth?: string;
  devAuth?: boolean;
}

export function initErrorPayload(error: string) {
  return { command: "init", applied: false, error } as const;
}

function failInit(opts: InitOptions, message: string): never {
  if (opts.json) writeJson(initErrorPayload(message));
  else if (process.stdout.isTTY) p.cancel(message);
  else process.stderr.write(`${message}\n`);
  process.exit(1);
}

const REQUIRED_DEPS: ReadonlyArray<DependencyRequirement> = [
  { pkg: "@flowpanel/kit", dev: false },
  { pkg: "@flowpanel/cli", dev: true },
];

/**
 * Spawns the detected package manager's `add` in `cwd`. Output is captured rather
 * than discarded: when an install fails the reason is almost always one line of
 * the manager's own stderr, and swallowing it leaves the user with nothing to act on.
 */
function runInstall(
  bin: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? `${bin}.cmd` : bin;
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let output = "";
    let pending = "";
    let discardLine = false;
    const appendLine = (line: string) => {
      output = Buffer.from(`${output}${redactDiagnostic(line)}`)
        .subarray(-4_096)
        .toString();
    };
    const capture = (data: Buffer) => {
      pending += data.toString();
      let newline = pending.indexOf("\n");
      while (newline !== -1) {
        if (!discardLine) appendLine(pending.slice(0, newline + 1));
        pending = pending.slice(newline + 1);
        discardLine = false;
        newline = pending.indexOf("\n");
      }
      if (Buffer.byteLength(pending) > 2_048) {
        pending = "";
        discardLine = true;
      }
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.on("close", (code) => {
      if (!discardLine && pending) appendLine(pending);
      resolve({ code: code ?? 1, output });
    });
    child.on("error", (e) => resolve({ code: 1, output: redactDiagnostic(e.message) }));
  });
}

const GUESSED_AUTH_FILE = "server/lib/auth.ts";

/**
 * Import specifiers the generated config falls back to when nothing matched on
 * disk. Without an `@/*` alias the guess has to be relative, or it cannot resolve.
 */
export function guessedPaths(
  orm: "drizzle" | "prisma",
  aliasMode: PathAliasMode,
): { db: string; schema: string; auth: string } {
  return {
    db: aliasOf(orm === "prisma" ? "lib/prisma.ts" : "server/lib/db.ts", aliasMode),
    schema: aliasOf("server/lib/db/schema.ts", aliasMode),
    auth: aliasOf(GUESSED_AUTH_FILE, aliasMode),
  };
}

/** Project-relative file the guessed `auth` specifier resolves to. */
export function guessedAuthFile(aliasMode: PathAliasMode): string {
  return aliasMode === "strip-src" ? `src/${GUESSED_AUTH_FILE}` : GUESSED_AUTH_FILE;
}

export function initCommand(cli: Command): void {
  cli
    .command("init")
    .description("Initialize FlowPanel in this project")
    .option("--yes", "Accept detected defaults without prompting (CI mode)")
    .option("--dry-run", "Print the filesystem plan without writing or installing")
    .option("--json", "Emit machine-readable JSON (implies --yes)")
    .option("--path <url>", "Mount the admin at a static URL, for example /ops/admin")
    .option("--db <module>", "Local module exporting your db or prisma client")
    .option("--schema <module>", "Local module exporting your Drizzle schema")
    .option("--auth <module>", "Local module exporting getSession(request)")
    .option("--dev-auth", "Explicitly use an open development-only admin identity")
    .action(async (opts: InitOptions) => {
      const cwd = process.cwd();
      const unattended = opts.yes || opts.dryRun || opts.json;
      const humanOutput = !opts.json && process.stdout.isTTY;

      if (!unattended && !process.stdin.isTTY) {
        failInit(
          opts,
          "init asks questions and this run has no interactive terminal. Re-run with --yes to accept the detected defaults.",
        );
      }

      const pmDetection = await detectPackageManagerDetails(cwd);
      if (pmDetection.error) failInit(opts, pmDetection.error);
      const pm = pmDetection.manager;
      const pmc = pmCommands(pm);
      if (humanOutput) p.intro(pc.bgCyan(pc.black(" FlowPanel init ")));
      const compatibility = await inspectProjectCompatibility(cwd);
      const prerequisiteFailure = firstCompatibilityFailure(
        compatibility.findings.filter(
          (finding) => !["drizzle-orm", "@prisma/client"].includes(finding.name),
        ),
      );
      if (prerequisiteFailure) failInit(opts, prerequisiteFailure);
      const selectedOrm = compatibility.ormFinding;
      if (compatibility.orm === null || selectedOrm === null) {
        failInit(
          opts,
          `No ORM detected. Install one: ${pmc.addDisplay("drizzle-orm", false)}  (or ${pmc.addDisplay("@prisma/client prisma", false)}).`,
        );
      }
      if (!selectedOrm.ok) {
        const failure = firstCompatibilityFailure([selectedOrm]);
        failInit(opts, failure ?? "The selected ORM is unsupported.");
      }

      const kitMismatch = await kitCompatibilityError(cwd);
      if (kitMismatch) {
        failInit(opts, kitMismatch);
      }

      const orm: "drizzle" | "prisma" = compatibility.orm;

      const parts = [
        `Next.js ${compatibility.findings.find((finding) => finding.name === "next")?.observed}`,
        `React ${compatibility.findings.find((finding) => finding.name === "react")?.observed}`,
        "TypeScript",
        orm === "drizzle" ? "Drizzle" : "Prisma",
      ].filter(Boolean) as string[];
      if (humanOutput) p.note(parts.join(" · "), "Detected stack");

      const aliasMode = await detectPathAlias(cwd);
      const detected = {
        db: await detectDbClient(cwd, aliasMode),
        schema: await detectSchema(cwd, aliasMode),
        auth: await detectAuth(cwd, aliasMode),
      };
      const guesses = guessedPaths(orm, aliasMode);
      const defaults = {
        db: detected.db ?? guesses.db,
        schema: detected.schema ?? guesses.schema,
        auth: detected.auth ?? guesses.auth,
        appName: path.basename(cwd),
      };
      const guessed = [
        detected.db === null ? `db client   ${defaults.db}` : null,
        orm === "drizzle" && detected.schema === null ? `schema      ${defaults.schema}` : null,
      ].filter(Boolean) as string[];

      let db = opts.db ?? defaults.db;
      let schemaPath = opts.schema ?? defaults.schema;
      let auth = opts.auth ?? defaults.auth;
      let appName = defaults.appName;

      if (unattended && guessed.length > 0 && humanOutput) {
        p.log.warn(
          `These paths were not detected and must resolve before installation:\n  ${guessed.join(
            "\n  ",
          )}\nUse --db and --schema to point to your modules, or re-run interactively.`,
        );
      }

      if (!unattended) {
        const appNameAns = await p.text({
          message: "App name",
          initialValue: defaults.appName,
        });
        if (p.isCancel(appNameAns)) {
          p.cancel("Aborted — nothing was written.");
          process.exit(1);
        }
        appName = appNameAns;

        const dbAns = await p.text({
          message:
            orm === "prisma"
              ? "Prisma client path (must export `prisma`)"
              : "Drizzle db client path",
          initialValue: db,
        });
        if (p.isCancel(dbAns)) {
          p.cancel("Aborted — nothing was written.");
          process.exit(1);
        }
        db = dbAns;

        if (orm === "drizzle") {
          const schemaAns = await p.text({
            message: "Drizzle schema path",
            initialValue: schemaPath,
          });
          if (p.isCancel(schemaAns)) {
            p.cancel("Aborted — nothing was written.");
            process.exit(1);
          }
          schemaPath = schemaAns;
        }

        const authAns = await p.text({
          message: "Auth helper path (must export getSession)",
          initialValue: auth,
        });
        if (p.isCancel(authAns)) {
          p.cancel("Aborted — nothing was written.");
          process.exit(1);
        }
        auth = authAns;
      }

      const sessionStub = detected.auth === null && auth === guesses.auth;
      for (const [specifier, exportName, flag] of [
        [db, orm === "prisma" ? "prisma" : "db", "--db"],
        ...(orm === "drizzle" ? [[schemaPath, undefined, "--schema"]] : []),
        ...(!sessionStub ? [[auth, "getSession", "--auth"]] : []),
      ] as Array<[string, string | undefined, string]>) {
        const problem = await validateProjectImport(cwd, specifier, exportName);
        if (problem)
          failInit(
            opts,
            `Nothing was written. ${problem}\nUse ${flag} <module> to select your module.`,
          );
      }

      const configTemplate =
        orm === "prisma" ? "flowpanel.config.prisma.ts.txt" : "flowpanel.config.drizzle.ts.txt";

      const adminCssTemplate = "admin.css.txt";

      const cssRel = aliasMode === "strip-src" ? "src/styles/admin.css" : "styles/admin.css";

      const appDir = await detectAppDir(cwd);
      const configuredMount = await readAdminMount(cwd);
      if (!opts.path && configuredMount.error) failInit(opts, configuredMount.error);
      let adminPath = normalizeAdminPath(opts.path ?? configuredMount.path ?? "/admin");
      const apiPath = "/api/flowpanel";
      if (
        adminPath === apiPath ||
        adminPath.startsWith(`${apiPath}/`) ||
        apiPath.startsWith(`${adminPath}/`)
      ) {
        failInit(
          opts,
          `Nothing was written. ${adminPath} overlaps the generated API at ${apiPath}. Choose a separate admin URL with --path.`,
        );
      }
      const mountWarnings: string[] = [];
      const conflictsFor = async (mount: string) => {
        const dir = `${appDir}${mount}/[[...slug]]`;
        const file = `${dir}/page.tsx`;
        const expected = await tpl("admin-page.tsx.txt", {
          CONFIG_IMPORT: configImportFor(dir, aliasMode),
        });
        const current = await fs.readFile(path.join(cwd, file), "utf8").catch(() => null);
        return findAdminRouteConflicts(cwd, appDir, mount, current === expected ? file : undefined);
      };
      let routeConflicts = await conflictsFor(adminPath);
      if (
        routeConflicts.length &&
        !opts.path &&
        adminPath === "/admin" &&
        !(await fileExists(path.join(cwd, "flowpanel.config.ts")))
      ) {
        mountWarnings.push(`/admin is occupied by ${routeConflicts.join(", ")}; using /flowpanel.`);
        adminPath = "/flowpanel";
        routeConflicts = await conflictsFor(adminPath);
      }
      if (routeConflicts.length) {
        failInit(
          opts,
          `Nothing was written. ${adminPath} overlaps existing routes:\n  ${routeConflicts.join("\n  ")}\nChoose a free URL with --path /ops/admin.`,
        );
      }
      if (humanOutput) {
        for (const warning of mountWarnings) p.log.warn(warning);
        p.note(adminPath, "Admin URL");
      }
      const adminPageDir = `${appDir}${adminPath}/[[...slug]]`;
      const apiRouteDir = `${appDir}/api/flowpanel/[...route]`;
      const sseRouteDir = `${appDir}/api/flowpanel/stream`;

      const files: Record<string, string> = {
        "flowpanel.config.ts": await tpl(configTemplate, {
          DB: db,
          SCHEMA: schemaPath,
          AUTH: auth,
          APP_NAME: appName,
          ADMIN_PATH: adminPath,
        }),
        [`${adminPageDir}/page.tsx`]: await tpl("admin-page.tsx.txt", {
          CONFIG_IMPORT: configImportFor(adminPageDir, aliasMode),
        }),
        [`${apiRouteDir}/route.ts`]: await tpl("api-route.ts.txt", {
          CONFIG_IMPORT: configImportFor(apiRouteDir, aliasMode),
        }),
        [`${sseRouteDir}/route.ts`]: await tpl("sse-route.ts.txt", {
          CONFIG_IMPORT: configImportFor(sseRouteDir, aliasMode),
        }),
        [cssRel]: await tpl(adminCssTemplate),
        "flowpanel/migrations/0001_init.sql": await tpl("migration.sql.txt"),
      };

      // Nothing on disk exports getSession, so the config above imports a path
      // that has to be created too — otherwise every later step dies on it.
      const sessionStubFile = guessedAuthFile(aliasMode);
      if (sessionStub)
        files[sessionStubFile] = await tpl(
          opts.devAuth ? "dev-session.ts.txt" : "auth-session.ts.txt",
        );

      const existingLayout = await findAppLayout(cwd);
      const adminLayoutDir = `${appDir}${adminPath}`;
      const cssImportSpec =
        aliasMode === "none"
          ? path.relative(adminLayoutDir, cssRel).split(path.sep).join("/")
          : "@/styles/admin.css";
      // A project with route-group root layouts needs a root for this new
      // segment too. In either case, never rewrite the host's root layout.
      files[`${adminLayoutDir}/layout.tsx`] = await tpl(
        existingLayout ? "admin-layout.tsx.txt" : "app-layout.tsx.txt",
        {
          APP_NAME: appName,
          CSS_IMPORT: cssImportSpec,
        },
      );

      const intents: FileIntent[] = Object.entries(files).map(([file, content]) => ({
        path: file,
        content,
      }));

      const plan = await createFilesystemPlan(cwd, intents);
      const conflicts = plan.operations.filter((operation) => operation.kind === "conflict");
      if (conflicts.length > 0) {
        if (opts.json) writePlanJson("init", plan, false);
        else if (humanOutput) {
          p.cancel(
            `Nothing was written. FlowPanel will not overwrite files it does not own:\n  ${conflicts
              .map((operation) => operation.path)
              .join(
                "\n  ",
              )}\nMove them, merge the generated changes manually, or run doctor for details.`,
          );
        } else
          process.stderr.write(
            "FlowPanel will not overwrite files it does not own. Re-run with --json for the plan.\n",
          );
        process.exit(1);
      }

      if (opts.dryRun) {
        if (opts.json) writePlanJson("init", plan, false);
        else if (humanOutput) {
          const preview = publicPlan(plan);
          p.note(
            preview.operations
              .map((operation) => `${operation.kind.padEnd(6)} ${operation.path}`)
              .join("\n"),
            "Filesystem plan (no changes applied)",
          );
          p.outro(pc.dim("Dry run complete."));
        } else {
          for (const operation of publicPlan(plan).operations) {
            process.stdout.write(`${operation.kind} ${operation.path}\n`);
          }
        }
        return;
      }

      if (!unattended) {
        p.note(
          publicPlan(plan)
            .operations.map((op) => `${op.kind.padEnd(6)} ${op.path}`)
            .join("\n"),
          "Filesystem plan",
        );
        const confirmed = await p.confirm({ message: "Apply these changes?", initialValue: true });
        if (p.isCancel(confirmed) || !confirmed) {
          p.cancel("Aborted — nothing was written.");
          return;
        }
      }

      const writtenPaths = await applyFilesystemPlan(plan);
      if (humanOutput && writtenPaths.length > 0) p.note(writtenPaths.join("\n"), "Wrote");

      const beforeInstall = await inspectRequirements(cwd, REQUIRED_DEPS, inspectDependency);
      const missing = missingDependencies(beforeInstall);
      let attempts: InstallAttempt[] = [];
      let installFailure: string | null = null;
      if (missing.length > 0) {
        const names = missing
          .map(
            ({ dependency, state }) => state.declaration?.specifier ?? pinnedSpec(dependency.pkg),
          )
          .join(", ");
        // A spinner in a pipe floods CI logs with ANSI redraw frames.
        const depSpinner = humanOutput ? p.spinner() : null;
        if (depSpinner) depSpinner.start(`Installing ${names} with ${pm}`);
        else if (humanOutput) p.log.step(`Installing ${names} with ${pm}…`);
        const outcome = await installMissing({
          cwd,
          pm,
          pmc,
          missing,
          inspect: inspectDependency,
          run: runInstall,
        });
        attempts = outcome.attempts;
        installFailure = outcome.failure;
        if (installFailure === null) {
          if (depSpinner) depSpinner.stop(`Installed ${names}`);
          else if (humanOutput) p.log.success(`Installed ${names}`);
        } else {
          if (depSpinner) depSpinner.stop("Dependency install failed");
          else if (humanOutput) p.log.error("Dependency install failed");
        }
      }
      const afterInstall = await inspectRequirements(cwd, REQUIRED_DEPS, inspectDependency);
      const dependencies = dependencyReport({
        after: afterInstall,
        pm,
        pmc,
        installFailure,
        kitMismatch: await kitCompatibilityError(cwd),
      });
      const depsOk = dependencies.ok;
      if (humanOutput) {
        if (dependencies.reason) p.note(dependencies.reason, `${pm} said`);
        if (!depsOk) p.note(dependencies.recovery.join("\n"), "Remaining recovery");
      }

      const outroLines = [
        "Next:",
        `  ${pc.cyan(`${pmc.run} dev`)}  ${pc.dim("— start Next.js")}`,
        `  Open your configured Next.js origin at ${pc.cyan(adminPath)}  ${pc.dim(`— scaffolded under ${appDir}/`)}`,
      ];
      if (!depsOk) {
        outroLines.splice(
          0,
          outroLines.length,
          `${pc.yellow("⚠ FlowPanel init is incomplete")}`,
          ...(dependencies.reason ? [dependencies.reason] : []),
          ...dependencies.recovery,
        );
        process.exitCode = 1;
      } else if (dependencies.warning) {
        outroLines.unshift(
          `${pc.yellow("⚠")} ${pm} exited with an error while installing something else:`,
          dependencies.warning,
          "",
        );
      }
      if (sessionStub && depsOk) {
        outroLines.unshift(
          "",
          `  ${pc.yellow("!")} Authentication setup: ${pc.cyan(sessionStubFile)}`,
          opts.devAuth
            ? "    --dev-auth enabled: every development request is an admin. Replace before deploying."
            : "    Access is denied until getSession and auth.role are connected to your real provider.",
        );
      }
      if (opts.json) {
        writeJson({
          command: "init",
          applied: true,
          dependenciesInstalled: depsOk,
          dependencies: {
            installed: dependencies.installed,
            failed: dependencies.failed,
            attempts,
            ...(dependencies.reason ? { reason: dependencies.reason } : {}),
            ...(dependencies.warning ? { warning: dependencies.warning } : {}),
            recovery: dependencies.recovery,
          },
          files: {
            applied: writtenPaths,
            kept: publicPlan(plan)
              .operations.filter((operation) => operation.kind === "skip")
              .map((operation) => operation.path),
          },
          adminPath,
          warnings: mountWarnings,
          authentication: sessionStub
            ? opts.devAuth
              ? "development"
              : "setup-required"
            : "existing-helper",
          plan: publicPlan(plan),
        });
      } else if (humanOutput) p.outro(outroLines.join("\n"));
      else process.stdout.write(`${outroLines.join("\n")}\n`);
    });
}
