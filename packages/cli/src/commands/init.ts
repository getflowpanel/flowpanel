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
import {
  DEFAULT_API_PATH,
  findAdminRouteConflicts,
  normalizeAdminPath,
  readAdminMount,
} from "../utils/admin-path";
import { type AuthProvider, detectAuthProvider } from "../utils/auth-provider";
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
import { plainLog } from "../utils/log";
import { validateProjectImport } from "../utils/module-path";
import { writeJson, writePlanJson } from "../utils/output";
import { detectPrismaProvider } from "../utils/prisma-provider";
import { inspectDependency } from "../utils/project-packages";
import { noNextProject } from "../utils/project-root";
import { tpl } from "../utils/template";
import {
  type AuthSessionPlan,
  type DevStubReplacement,
  planAuthSession,
  planDevStubReplacement,
} from "./init-auth";
import {
  type DependencyRequirement,
  dependencyReport,
  type InstallAttempt,
  inspectRequirements,
  installMissing,
  missingDependencies,
} from "./init-dependencies";
import { findAppLayout, patchLayoutWithSuppressHydration } from "./init-layout";
import {
  type AuthOutcome,
  authNotice,
  conflictMessage,
  customisedSessionMessage,
  nextSteps,
  PROVIDER_FALLBACK_WARNING,
  unsupportedProviderMessage,
} from "./init-output";
import {
  ABORTED,
  abortOnCancel,
  askDevAuth,
  askText,
  authAnswerCheck,
  shouldAskDevAuth,
  writesSessionStub,
} from "./init-prompts";

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

// Output is captured, not discarded: a failure's reason is almost always one line of stderr.
function runInstall(
  bin: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const windows = process.platform === "win32";
    const child = spawn(windows ? `${bin}.cmd` : bin, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: windows,
    });
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

const METADATA_EXPORT = "export const generateMetadata = flowpanel.metadata;\n";

function previousAdminPage(page: string): string {
  return page.replace(METADATA_EXPORT, "");
}

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
    .option("--path <path>", "Mount the admin at a static path, for example /ops/admin")
    .option("--db <module>", "Local module exporting your db or prisma client")
    .option("--schema <module>", "Local module exporting your Drizzle schema")
    .option("--auth <module>", "Local module exporting getSession(request)")
    .option("--dev-auth", "Explicitly use an open development-only admin identity")
    .action(async (opts: InitOptions) => {
      const cwd = process.cwd();
      const unattended = opts.yes || opts.dryRun || opts.json;
      const humanOutput = !opts.json && process.stdout.isTTY;
      const textOutput = !opts.json && !process.stdout.isTTY;
      const colors = pc.createColors(Boolean(humanOutput));
      const warn = (message: string) => {
        if (humanOutput) p.log.warn(message);
        else if (textOutput) plainLog.warn(message);
      };

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
      const notProject = await noNextProject(cwd);
      if (notProject) failInit(opts, notProject);
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
      const providerLookup = orm === "prisma" ? await detectPrismaProvider(cwd) : null;
      if (providerLookup?.status === "unsupported") {
        failInit(opts, unsupportedProviderMessage(providerLookup.provider));
      }
      const prismaProvider =
        providerLookup?.status === "found" ? providerLookup.provider : "postgresql";

      const authProvider: AuthProvider | null = await detectAuthProvider(cwd);

      const parts = [
        `Next.js ${compatibility.findings.find((finding) => finding.name === "next")?.observed}`,
        `React ${compatibility.findings.find((finding) => finding.name === "react")?.observed}`,
        "TypeScript",
        orm === "drizzle" ? "Drizzle" : "Prisma",
        authProvider,
      ].filter(Boolean) as string[];
      if (humanOutput) p.note(parts.join(" · "), "Detected stack");

      const aliasMode = await detectPathAlias(cwd);
      const detected = {
        db: await detectDbClient(cwd, aliasMode),
        schema: await detectSchema(cwd, aliasMode),
        auth: await detectAuth(cwd, aliasMode),
      };
      let authPlan: AuthSessionPlan | null = opts.auth
        ? null
        : await planAuthSession({
            cwd,
            provider: authProvider,
            detectedAuth: detected.auth,
            aliasMode,
            devAuth: !!opts.devAuth,
          });
      const guesses = guessedPaths(orm, aliasMode);
      const defaults = {
        db: detected.db ?? guesses.db,
        schema: detected.schema ?? guesses.schema,
        auth: authPlan?.specifier ?? detected.auth ?? guesses.auth,
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

      if (unattended && guessed.length > 0) {
        warn(
          `These paths were not detected and must resolve before installation:\n  ${guessed.join(
            "\n  ",
          )}\nUse --db and --schema to point to your modules, or re-run interactively.`,
        );
      }

      if (!unattended) {
        appName = await askText({ message: "App name", initialValue: defaults.appName });
        db = await askText({
          message:
            orm === "prisma"
              ? "Prisma client path (must export `prisma`)"
              : "Drizzle db client path",
          initialValue: db,
          check: (answer) => validateProjectImport(cwd, answer, orm === "prisma" ? "prisma" : "db"),
        });
        if (orm === "drizzle") {
          schemaPath = await askText({
            message: "Drizzle schema path",
            initialValue: schemaPath,
            check: (answer) => validateProjectImport(cwd, answer),
          });
        }
        auth = await askText({
          message: "Auth helper path (must export getSession)",
          initialValue: auth,
          check: authAnswerCheck({
            plannedSession: authPlan?.specifier ?? null,
            detectedAuth: detected.auth,
            guessedAuth: guesses.auth,
            validate: (answer) => validateProjectImport(cwd, answer, "getSession"),
          }),
        });
      }

      if (authPlan && auth !== authPlan.specifier) authPlan = null;
      const sessionStub = writesSessionStub({
        detectedAuth: detected.auth,
        guessedAuth: guesses.auth,
        answer: auth,
      });
      let devAuth = !!opts.devAuth;
      if (shouldAskDevAuth({ unattended: !!unattended, sessionStub, devAuth })) {
        devAuth = await askDevAuth();
      }
      for (const [specifier, exportName, flag] of [
        [db, orm === "prisma" ? "prisma" : "db", "--db"],
        ...(orm === "drizzle" ? [[schemaPath, undefined, "--schema"]] : []),
        ...(!sessionStub && !authPlan ? [[auth, "getSession", "--auth"]] : []),
      ] as Array<[string, string | undefined, string]>) {
        const problem = await validateProjectImport(cwd, specifier, exportName);
        if (problem)
          failInit(
            opts,
            `Nothing was written. ${problem}\nUse ${flag} <module> to select your module.`,
          );
      }

      const sessionReplacement: DevStubReplacement | null =
        devAuth && !sessionStub && !opts.auth ? await planDevStubReplacement(cwd, auth) : null;
      if (sessionReplacement?.kind === "customised") {
        failInit(opts, customisedSessionMessage(sessionReplacement.file));
      }

      const configTemplate = `flowpanel.config.${orm}${authPlan ? ".preset" : ""}.ts.txt`;

      const adminCssTemplate = "admin.css.txt";

      const cssRel = aliasMode === "strip-src" ? "src/styles/admin.css" : "styles/admin.css";

      const appDir = await detectAppDir(cwd);
      const configuredMount = await readAdminMount(cwd);
      if (!opts.path && configuredMount.error) failInit(opts, configuredMount.error);
      let adminPath = normalizeAdminPath(opts.path ?? configuredMount.path ?? "/admin");
      // A dynamic mount value is unknown, and scaffolding the default over it would be a guess.
      if (configuredMount.api === null) {
        failInit(
          opts,
          "Nothing was written. paths.api in flowpanel.config.ts is not a static string, so init cannot tell where the route handlers belong.",
        );
      }
      const apiPath = configuredMount.api ?? DEFAULT_API_PATH;
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
      if (providerLookup?.status === "missing") mountWarnings.push(PROVIDER_FALLBACK_WARNING);
      const conflictsFor = async (mount: string) => {
        const dir = `${appDir}${mount}/[[...slug]]`;
        const file = `${dir}/page.tsx`;
        const expected = await tpl("admin-page.tsx.txt", {
          CONFIG_IMPORT: configImportFor(dir, aliasMode),
        });
        const current = await fs.readFile(path.join(cwd, file), "utf8").catch(() => null);
        const ours = current === expected || current === previousAdminPage(expected);
        return findAdminRouteConflicts(cwd, appDir, mount, ours ? file : undefined);
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
      for (const warning of mountWarnings) warn(warning);
      if (humanOutput) p.note(adminPath, "Admin URL");
      const adminPageDir = `${appDir}${adminPath}/[[...slug]]`;
      const apiRouteDir = `${appDir}${apiPath}/[...route]`;
      const sseRouteDir = `${appDir}${apiPath}/stream`;

      const files: Record<string, string> = {
        "flowpanel.config.ts": await tpl(configTemplate, {
          DB: db,
          SCHEMA: schemaPath,
          AUTH: auth,
          APP_NAME: appName,
          ADMIN_PATH: adminPath,
          API_PATH: apiPath,
          CLI: `${pmc.exec} flowpanel`,
          PROVIDER: prismaProvider,
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

      // Nothing on disk exports getSession, so the imported path must be created too.
      const sessionStubFile = authPlan?.file ?? guessedAuthFile(aliasMode);
      if (authPlan) files[sessionStubFile] = await tpl(authPlan.template, authPlan.vars);
      else if (sessionStub)
        files[sessionStubFile] = await tpl(devAuth ? "dev-session.ts.txt" : "auth-session.ts.txt");
      else if (sessionReplacement) files[sessionReplacement.file] = sessionReplacement.content;

      const existingLayout = await findAppLayout(cwd);
      const adminLayoutDir = `${appDir}${adminPath}`;
      const cssImportSpec =
        aliasMode === "none"
          ? path.relative(adminLayoutDir, cssRel).split(path.sep).join("/")
          : "@/styles/admin.css";
      // Never rewrite the host's root layout, except to add suppressHydrationWarning (ThemeScript needs it).
      files[`${adminLayoutDir}/layout.tsx`] = await tpl(
        existingLayout ? "admin-layout.tsx.txt" : "app-layout.tsx.txt",
        {
          APP_NAME: appName,
          CSS_IMPORT: cssImportSpec,
        },
      );
      files[`${adminLayoutDir}/not-found.tsx`] = await tpl("admin-not-found.tsx.txt", {
        CONFIG_IMPORT: configImportFor(adminLayoutDir, aliasMode),
      });

      const expectedContents: Record<string, string> = {
        [`${adminPageDir}/page.tsx`]: previousAdminPage(
          files[`${adminPageDir}/page.tsx`] as string,
        ),
      };
      if (sessionReplacement) {
        expectedContents[sessionReplacement.file] = sessionReplacement.expectedContent;
      }
      let manualHydrationFix: string | null = null;
      if (existingLayout) {
        const existingLayoutSource = await fs.readFile(path.join(cwd, existingLayout), "utf8");
        const patchedLayout = patchLayoutWithSuppressHydration(existingLayoutSource);
        if (patchedLayout) {
          files[existingLayout] = patchedLayout;
          expectedContents[existingLayout] = existingLayoutSource;
        } else if (!existingLayoutSource.includes("suppressHydrationWarning")) {
          manualHydrationFix = existingLayout;
          const message = `Could not add suppressHydrationWarning to ${existingLayout}; add it to <html> by hand.`;
          mountWarnings.push(message);
          if (opts.dryRun) warn(message);
        }
      }

      const intents: FileIntent[] = Object.entries(files).map(([file, content]) => ({
        path: file,
        content,
        ...(expectedContents[file] !== undefined
          ? { expectedContent: expectedContents[file] }
          : {}),
      }));

      const plan = await createFilesystemPlan(cwd, intents);
      const conflicts = plan.operations.filter((operation) => operation.kind === "conflict");
      if (conflicts.length > 0) {
        if (opts.json) {
          writePlanJson("init", plan, false);
          process.exit(1);
        }
        failInit(opts, conflictMessage(conflicts.map((operation) => operation.path)));
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
        const confirmed = abortOnCancel(
          await p.confirm({ message: "Apply these changes?", initialValue: true }),
        );
        if (!confirmed) {
          p.cancel(ABORTED);
          return;
        }
      }

      const writtenPaths = await applyFilesystemPlan(plan);
      if (writtenPaths.length > 0) {
        if (humanOutput) p.note(writtenPaths.join("\n"), "Wrote");
        else if (textOutput) {
          process.stdout.write(`Wrote\n${writtenPaths.map((file) => `  ${file}`).join("\n")}\n`);
        }
      }

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
        else if (textOutput) plainLog.info(`Installing ${names} with ${pm}`);
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
          else if (textOutput) plainLog.ok(`Installed ${names}`);
        } else {
          if (depSpinner) depSpinner.stop("Dependency install failed");
          else if (textOutput) plainLog.err("Dependency install failed");
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

      const authOutcome: AuthOutcome = authPlan
        ? { kind: "preset", file: sessionStubFile, provider: authPlan.provider }
        : sessionStub
          ? { kind: devAuth ? "dev-stub" : "closed-stub", file: sessionStubFile }
          : sessionReplacement
            ? { kind: "dev-stub", file: sessionReplacement.file }
            : { kind: "existing" };
      const paragraphs: string[] = [];
      if (!depsOk) {
        paragraphs.push(
          [
            colors.yellow("⚠ FlowPanel init is incomplete"),
            ...(dependencies.reason ? [dependencies.reason] : []),
            ...dependencies.recovery,
          ].join("\n"),
        );
        process.exitCode = 1;
      } else {
        if (dependencies.warning) {
          paragraphs.push(
            `${colors.yellow("⚠")} ${pm} exited with an error while installing something else:\n${dependencies.warning}`,
          );
        }
        if (manualHydrationFix) {
          paragraphs.push(
            `${colors.yellow("!")} Could not add suppressHydrationWarning to ${colors.cyan(manualHydrationFix)}\n  Add it to that file's <html> tag by hand — ThemeScript sets an attribute on it before hydration.`,
          );
        }
        const notice = authNotice(authOutcome);
        if (notice) paragraphs.push(notice);
        paragraphs.push(nextSteps(pmc, adminPath, colors, orm === "prisma" ? "model" : "table"));
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
          authentication: authPlan
            ? `preset:${authPlan.provider}`
            : sessionStub
              ? devAuth
                ? "development"
                : "setup-required"
              : sessionReplacement
                ? "development"
                : "existing-helper",
          ...(authProvider ? { authProvider } : {}),
          plan: publicPlan(plan),
        });
      } else if (humanOutput) p.outro(paragraphs.join("\n\n"));
      else process.stdout.write(`${paragraphs.join("\n\n")}\n`);
    });
}
