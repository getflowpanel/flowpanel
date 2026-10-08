// LOC-OK: one transactional scaffold flow; prompting, planning and installation order stay explicit.
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { findSessionStub } from "../doctor/session-module";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent } from "../plan/types";
import { findAdminConfig } from "../scaffold/config-target";
import { adminPageSource, isGeneratedAdminPage } from "../utils/admin-page";
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
  type PathAliasMode,
  type PmCommands,
  pmCommands,
} from "../utils/detect";
import { redactDiagnostic } from "../utils/fail";
import { kitCompatibilityError, pinnedSpec } from "../utils/kit";
import { plainLog } from "../utils/log";
import { resolveProjectModule, validateProjectImport } from "../utils/module-path";
import { usesCacheComponents } from "../utils/next-config";
import { writeJson, writePlanJson } from "../utils/output";
import { detectPrismaProvider } from "../utils/prisma-provider";
import { inspectDependency, projectManifest } from "../utils/project-packages";
import { noNextProject } from "../utils/project-root";
import {
  dialectFromDependencies,
  drizzleDialectFrom,
  migrationTemplate,
  type SqlDialect,
} from "../utils/sql-dialect";
import { tpl } from "../utils/template";
import {
  type AuthSessionPlan,
  type DevStubReplacement,
  devSessionStub,
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
import { planDevAuthOnProject } from "./init-dev-auth";
import { findAppLayout, patchLayoutWithSuppressHydration } from "./init-layout";
import {
  type AuthOutcome,
  adminUrl,
  authNotice,
  conflictMessage,
  customisedSessionMessage,
  type MissingModule,
  missingModuleMessage,
  nextSteps,
  noOrmMessage,
  PROVIDER_FALLBACK_WARNING,
  unsupportedProviderMessage,
  wrapWords,
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
import {
  configImportTemplateCall,
  configTemplateCall,
  layoutTemplateCall,
  renderCall,
} from "./init-templates";

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
const MIGRATION_FILE = "flowpanel/migrations/0001_init.sql";

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

/** Project-relative file a guessed specifier resolves to. */
function guessedFile(relPath: string, aliasMode: PathAliasMode): string {
  return aliasMode === "strip-src" ? `src/${relPath}` : relPath;
}

/** Project-relative file the guessed `auth` specifier resolves to. */
export function guessedAuthFile(aliasMode: PathAliasMode): string {
  return guessedFile(GUESSED_AUTH_FILE, aliasMode);
}

function noticeWidth(): number {
  return Math.max(40, Math.min(process.stdout.columns ?? 80, 100) - 4);
}

/** `init --dev-auth` on a project init already set up: only the session module changes. */
async function devAuthOnProject(
  cwd: string,
  opts: InitOptions,
  pmc: PmCommands,
  humanOutput: boolean,
): Promise<void> {
  const planned = await planDevAuthOnProject(cwd);
  if (planned.kind === "refuse") failInit(opts, planned.message);
  const { file, plan } = planned;
  const lines = publicPlan(plan).operations.map((op) => `${op.kind.padEnd(6)} ${op.path}`);
  if (opts.dryRun) {
    if (opts.json) writePlanJson("init", plan, false, { authentication: "development" });
    else if (humanOutput) {
      p.note(lines.join("\n"), "Filesystem plan (no changes applied)");
      p.outro(pc.dim("Dry run complete."));
    } else process.stdout.write(`${lines.join("\n")}\n`);
    return;
  }
  const changes = plan.operations.some((op) => op.kind !== "skip");
  if (changes && !opts.yes && !opts.json) {
    p.note(lines.join("\n"), "Filesystem plan");
    const confirmed = abortOnCancel(
      await p.confirm({ message: "Apply these changes?", initialValue: true }),
    );
    if (!confirmed) {
      p.cancel(ABORTED);
      return;
    }
  }
  const written = await applyFilesystemPlan(plan);
  if (opts.json) {
    writeJson({
      command: "init",
      applied: written.length > 0,
      files: { applied: written },
      authentication: "development",
      plan: publicPlan(plan),
    });
    return;
  }
  const done =
    written.length > 0
      ? `Wrote ${file}`
      : `${file} is already the development identity; nothing changed.`;
  const notice = authNotice({ kind: "dev-stub", file }, pmc) ?? "";
  const url = adminUrl((await readAdminMount(cwd)).path ?? "/admin");
  if (humanOutput) {
    p.log.success(done);
    p.log.warn(wrapWords(notice, noticeWidth()));
    p.outro(`Admin: ${pc.cyan(url)}`);
  } else process.stdout.write(`${done}\n! ${notice}\nAdmin: ${url}\n`);
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
      const existingConfig = await findAdminConfig(cwd);
      if (opts.devAuth && existingConfig !== null) {
        await devAuthOnProject(cwd, opts, pmc, Boolean(humanOutput));
        return;
      }
      const compatibility = await inspectProjectCompatibility(cwd);
      const prerequisiteFailure = firstCompatibilityFailure(
        compatibility.findings.filter(
          (finding) => !["drizzle-orm", "@prisma/client"].includes(finding.name),
        ),
      );
      if (prerequisiteFailure) failInit(opts, prerequisiteFailure);
      const selectedOrm = compatibility.ormFinding;
      if (compatibility.orm === null || selectedOrm === null) {
        failInit(opts, noOrmMessage(pmc));
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
      let db = opts.db ?? defaults.db;
      let schemaPath = opts.schema ?? defaults.schema;
      let auth = opts.auth ?? defaults.auth;
      let appName = defaults.appName;

      if (!unattended) {
        appName = await askText({
          message: "App name, shown as the sidebar brand",
          initialValue: defaults.appName,
        });
        db = await askText({
          message:
            orm === "prisma"
              ? "Prisma client module, as an import path (exports prisma)"
              : "Drizzle client module, as an import path (exports db)",
          initialValue: db,
          check: (answer) => validateProjectImport(cwd, answer, orm === "prisma" ? "prisma" : "db"),
        });
        if (orm === "drizzle") {
          schemaPath = await askText({
            message: "Drizzle schema module, as an import path",
            initialValue: schemaPath,
            check: (answer) => validateProjectImport(cwd, answer),
          });
        }
        auth = await askText({
          message: "Session module, as an import path (exports getSession)",
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
      const guessedDb: MissingModule = {
        kind: orm === "prisma" ? "prisma" : "db",
        file: guessedFile(orm === "prisma" ? "lib/prisma.ts" : "server/lib/db.ts", aliasMode),
        flag: "--db",
      };
      const guessedSchema: MissingModule = {
        kind: "schema",
        file: guessedFile("server/lib/db/schema.ts", aliasMode),
        flag: "--schema",
      };
      const imports: Array<[string, string | undefined, string, MissingModule | null]> = [
        [db, orm === "prisma" ? "prisma" : "db", "--db", db === guesses.db ? guessedDb : null],
      ];
      if (orm === "drizzle") {
        imports.push([
          schemaPath,
          undefined,
          "--schema",
          schemaPath === guesses.schema ? guessedSchema : null,
        ]);
      }
      if (!sessionStub && !authPlan) imports.push([auth, "getSession", "--auth", null]);
      const missingModules: MissingModule[] = [];
      for (const [specifier, exportName, flag, guess] of imports) {
        const problem = await validateProjectImport(cwd, specifier, exportName);
        if (!problem) continue;
        if (guess && (await resolveProjectModule(cwd, specifier)) === null) {
          missingModules.push(guess);
        } else {
          failInit(
            opts,
            `Nothing was written. ${problem}\nUse ${flag} <module> to select your module.`,
          );
        }
      }
      if (missingModules.length > 0) failInit(opts, missingModuleMessage(missingModules, pmc));

      const sessionReplacement: DevStubReplacement | null =
        devAuth && !sessionStub && !opts.auth ? await planDevStubReplacement(cwd, auth) : null;
      if (sessionReplacement?.kind === "customised") {
        failInit(opts, customisedSessionMessage(sessionReplacement.file, false));
      }

      const manifest = await projectManifest(cwd);
      const drizzleDialect =
        orm === "drizzle"
          ? ((await drizzleDialectFrom(cwd, [schemaPath, db])) ??
            dialectFromDependencies({ ...manifest?.dependencies, ...manifest?.devDependencies }))
          : null;
      const dialect: SqlDialect =
        orm === "prisma" ? prismaProvider : (drizzleDialect ?? "postgresql");

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
      if (orm === "drizzle" && drizzleDialect === null) {
        mountWarnings.push(
          "Could not tell from your Drizzle modules whether the database is PostgreSQL, MySQL or SQLite; flowpanel/migrations/0001_init.sql is written for PostgreSQL.",
        );
      }
      const conflictsFor = async (mount: string) => {
        const dir = `${appDir}${mount}/[[...slug]]`;
        const file = `${dir}/page.tsx`;
        const current = await fs.readFile(path.join(cwd, file), "utf8").catch(() => null);
        const ours =
          current !== null &&
          (await isGeneratedAdminPage(current, configImportFor(dir, aliasMode)));
        return findAdminRouteConflicts(cwd, appDir, mount, ours ? file : undefined);
      };
      let routeConflicts = await conflictsFor(adminPath);
      if (
        routeConflicts.length &&
        !opts.path &&
        adminPath === "/admin" &&
        existingConfig === null
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
      if (humanOutput) p.log.info(`Admin URL: ${adminPath}`);
      const adminPageDir = `${appDir}${adminPath}/[[...slug]]`;
      const apiRouteDir = `${appDir}${apiPath}/[...route]`;
      const sseRouteDir = `${appDir}${apiPath}/stream`;

      const cacheComponents = await usesCacheComponents(cwd);
      const configRel = existingConfig
        ? path.relative(cwd, existingConfig.root).split(path.sep).join("/")
        : "flowpanel.config.ts";
      const files: Record<string, string> = {
        [configRel]:
          (existingConfig
            ? await fs.readFile(existingConfig.root, "utf8").catch(() => null)
            : null) ??
          (await renderCall(
            configTemplateCall({
              orm,
              preset: authPlan !== null,
              db,
              schema: schemaPath,
              auth,
              appName,
              adminPath,
              apiPath,
              cli: `${pmc.exec} flowpanel`,
              provider: prismaProvider,
              session: sessionStub || sessionReplacement ? "stub" : "own",
            }),
          )),
        [`${adminPageDir}/page.tsx`]: await adminPageSource(
          configImportFor(adminPageDir, aliasMode),
          cacheComponents,
        ),
        [`${apiRouteDir}/route.ts`]: await renderCall(
          configImportTemplateCall("api-route.ts.txt", configImportFor(apiRouteDir, aliasMode)),
        ),
        [`${sseRouteDir}/route.ts`]: await renderCall(
          configImportTemplateCall("sse-route.ts.txt", configImportFor(sseRouteDir, aliasMode)),
        ),
        [cssRel]: await tpl(adminCssTemplate),
        [MIGRATION_FILE]:
          (await fs.readFile(path.join(cwd, MIGRATION_FILE), "utf8").catch(() => null)) ??
          (await tpl(migrationTemplate(dialect))),
      };

      const sessionStubFile = authPlan?.file ?? guessedAuthFile(aliasMode);
      if (authPlan) files[sessionStubFile] = await renderCall(authPlan);
      else if (sessionStub)
        files[sessionStubFile] = devAuth
          ? await devSessionStub(sessionStubFile)
          : await tpl("auth-session.ts.txt");
      else if (sessionReplacement) files[sessionReplacement.file] = sessionReplacement.content;

      const existingLayout = await findAppLayout(cwd);
      const adminLayoutDir = `${appDir}${adminPath}`;
      const cssImportSpec =
        aliasMode === "none"
          ? path.relative(adminLayoutDir, cssRel).split(path.sep).join("/")
          : "@/styles/admin.css";
      // Never rewrite the host's root layout, except to add suppressHydrationWarning (ThemeScript needs it).
      files[`${adminLayoutDir}/layout.tsx`] = await renderCall(
        layoutTemplateCall(existingLayout !== null, appName, cssImportSpec, cacheComponents),
      );
      files[`${adminLayoutDir}/not-found.tsx`] = await renderCall(
        configImportTemplateCall(
          "admin-not-found.tsx.txt",
          configImportFor(adminLayoutDir, aliasMode),
        ),
      );

      const expectedContents: Record<string, string> = {};
      const currentAdminPage = await fs
        .readFile(path.join(cwd, `${adminPageDir}/page.tsx`), "utf8")
        .catch(() => null);
      if (
        currentAdminPage !== null &&
        (await isGeneratedAdminPage(currentAdminPage, configImportFor(adminPageDir, aliasMode)))
      ) {
        expectedContents[`${adminPageDir}/page.tsx`] = currentAdminPage;
      }
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
        const message = conflictMessage(conflicts.map((operation) => operation.path));
        if (opts.json) {
          writePlanJson("init", plan, false, { error: message });
          process.exit(1);
        }
        failInit(opts, message);
      }

      const plannedAuth: AuthOutcome = authPlan
        ? { kind: "preset", file: sessionStubFile, provider: authPlan.provider }
        : sessionStub
          ? { kind: devAuth ? "dev-stub" : "closed-stub", file: sessionStubFile }
          : sessionReplacement
            ? { kind: "dev-stub", file: sessionReplacement.file }
            : { kind: "existing" };
      const authentication = authPlan
        ? `preset:${authPlan.provider}`
        : plannedAuth.kind === "dev-stub"
          ? "development"
          : plannedAuth.kind === "closed-stub"
            ? "setup-required"
            : "existing-helper";

      if (opts.dryRun) {
        const sessionLabel = {
          "closed-stub": "closed stub, denies every request",
          "dev-stub": "open development identity",
          preset: "provider preset",
          existing: "your module",
        }[plannedAuth.kind];
        const modules = {
          db,
          ...(orm === "drizzle" ? { schema: schemaPath } : {}),
          session: "file" in plannedAuth ? plannedAuth.file : auth,
          migration: dialect,
        };
        const detectedLines = [
          `db client   ${db}`,
          ...(orm === "drizzle" ? [`schema      ${schemaPath}`] : []),
          `session     ${modules.session} (${sessionLabel})`,
          `migration   ${dialect}`,
        ];
        const planLines = publicPlan(plan).operations.map(
          (operation) => `${operation.kind.padEnd(6)} ${operation.path}`,
        );
        if (opts.json) writePlanJson("init", plan, false, { modules, authentication });
        else if (humanOutput) {
          p.note(detectedLines.join("\n"), "Modules");
          p.note(planLines.join("\n"), "Filesystem plan (no changes applied)");
          p.outro(pc.dim("Dry run complete."));
        } else process.stdout.write(`${[...detectedLines, "", ...planLines].join("\n")}\n`);
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
      const wrote =
        writtenPaths.length === 0
          ? "Already set up; nothing changed."
          : `Wrote ${writtenPaths.length} file${writtenPaths.length === 1 ? "" : "s"}`;
      if (humanOutput) {
        if (unattended && writtenPaths.length > 0) p.note(writtenPaths.join("\n"), "Wrote");
        else p.log.success(wrote);
      } else if (textOutput) {
        process.stdout.write(
          writtenPaths.length > 0
            ? `Wrote\n${writtenPaths.map((file) => `  ${file}`).join("\n")}\n`
            : `${wrote}\n`,
        );
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

      const stub = await findSessionStub(cwd);
      const authOutcome: AuthOutcome =
        plannedAuth.kind === "preset"
          ? plannedAuth
          : stub
            ? { kind: stub.kind === "closed" ? "closed-stub" : "dev-stub", file: stub.file }
            : { kind: "existing" };
      const notice = authNotice(authOutcome, pmc);

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
          authentication,
          ...(authProvider ? { authProvider } : {}),
          plan: publicPlan(plan),
        });
        if (!depsOk) process.exitCode = 1;
        return;
      }

      if (!depsOk) {
        process.exitCode = 1;
        const incomplete = [
          ...(dependencies.reason ? [dependencies.reason] : []),
          ...dependencies.recovery,
        ].join("\n");
        if (humanOutput) {
          p.note(incomplete, "FlowPanel init is incomplete");
          p.outro(colors.yellow("Run the commands above, then init again."));
        } else process.stdout.write(`! FlowPanel init is incomplete\n${incomplete}\n`);
        return;
      }
      const warnings = [
        ...(dependencies.warning
          ? [`${pm} exited with an error while installing something else:\n${dependencies.warning}`]
          : []),
        ...(manualHydrationFix
          ? [
              `Could not add suppressHydrationWarning to ${manualHydrationFix}. Add it to that file's <html> tag by hand; ThemeScript sets an attribute on it before hydration.`,
            ]
          : []),
        ...(notice && authOutcome.kind !== "preset" ? [notice] : []),
      ];
      const info = notice && authOutcome.kind === "preset" ? notice : null;
      const url = adminUrl(adminPath);
      const next = nextSteps(pmc, colors, orm === "prisma" ? "model" : "table");
      if (humanOutput) {
        for (const warning of warnings) p.log.warn(wrapWords(warning, noticeWidth()));
        if (info) p.log.info(wrapWords(info, noticeWidth()));
        p.note(next, "Next");
        p.outro(`Admin: ${colors.cyan(url)}`);
      } else {
        const lines = [
          ...warnings.map((warning) => `! ${warning}`),
          ...(info ? [info] : []),
          "",
          "Next",
          ...next.split("\n").map((line) => `  ${line}`),
          "",
          `Admin: ${url}`,
        ];
        process.stdout.write(`${lines.join("\n")}\n`);
      }
    });
}
