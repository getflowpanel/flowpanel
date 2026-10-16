import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import type { FilesystemPlan } from "../plan/types";
import { adminPageSource, isGeneratedAdminPage } from "../utils/admin-page";
import {
  DEFAULT_API_PATH,
  findAdminRouteConflicts,
  normalizeAdminPath,
  readAdminMount,
} from "../utils/admin-path";
import { configProblem } from "../utils/config-problem";
import { configImportFor, detectAppDir } from "../utils/detect";
import { usesCacheComponents } from "../utils/next-config";
import { migrationTemplate } from "../utils/sql-dialect";
import { tpl } from "../utils/template";
import { devSessionStub } from "./init-auth";
import type { InitRun } from "./init-context";
import { type DetectedStack, guessedAuthFile } from "./init-detect";
import { findAppLayout, patchLayoutWithSuppressHydration } from "./init-layout";
import type { InitModules } from "./init-modules";
import { type AuthOutcome, conflictMessage, PROVIDER_FALLBACK_WARNING } from "./init-output";
import {
  configImportTemplateCall,
  configTemplateCall,
  layoutTemplateCall,
  renderCall,
} from "./init-templates";

const MIGRATION_FILE = "flowpanel/migrations/0001_init.sql";

const HEADER_HINT = (layout: string) =>
  `${layout} renders a <header> above every page. The admin's sidebar fills the window's height, so under that header each page scrolls by the header's height. Set shell: "tabs" in flowpanel.config.ts to put the admin's navigation under your header instead.`;

export interface InitPlan {
  plan: FilesystemPlan;
  adminPath: string;
  warnings: string[];
  /** The host's root layout init could not add `suppressHydrationWarning` to. */
  manualHydrationFix: string | null;
  auth: AuthOutcome;
  /** How the admin authenticates, as `--json` reports it. */
  authentication: string;
}

interface Mount {
  appDir: "app" | "src/app";
  adminPath: string;
  apiPath: string;
  warnings: string[];
}

/** The admin URL: `--path`, the config's, or `/admin`, moved to `/flowpanel` when a fresh project already uses `/admin`. */
async function resolveMount(run: InitRun, stack: DetectedStack): Promise<Mount> {
  const { cwd, opts } = run;
  const appDir = await detectAppDir(cwd);
  const configured = await readAdminMount(cwd);
  if (!opts.path && configured.error) run.fail(configured.error);
  let adminPath = normalizeAdminPath(opts.path ?? configured.path ?? "/admin");
  if (configured.api === null) {
    run.fail(
      configProblem(
        "paths.api",
        "not a string literal, so init cannot tell where the route handlers belong. Write it as a string, then run init again.",
      ),
    );
  }
  const apiPath = configured.api ?? DEFAULT_API_PATH;
  if (
    adminPath === apiPath ||
    adminPath.startsWith(`${apiPath}/`) ||
    apiPath.startsWith(`${adminPath}/`)
  ) {
    run.fail(
      `Nothing was written. ${adminPath} overlaps the generated API at ${apiPath}. Choose a separate admin URL with --path.`,
    );
  }
  const warnings: string[] = [];
  const conflictsFor = async (mount: string) => {
    const file = `${appDir}${mount}/[[...slug]]/page.tsx`;
    const current = await fs.readFile(path.join(cwd, file), "utf8").catch(() => null);
    const ours =
      current !== null &&
      (await isGeneratedAdminPage(current, configImportFor(path.dirname(file), stack.aliasMode)));
    return findAdminRouteConflicts(cwd, appDir, mount, ours ? file : undefined);
  };
  let conflicts = await conflictsFor(adminPath);
  if (conflicts.length && !opts.path && adminPath === "/admin" && stack.existingConfig === null) {
    warnings.push(`/admin is occupied by ${conflicts.join(", ")}; using /flowpanel.`);
    adminPath = "/flowpanel";
    conflicts = await conflictsFor(adminPath);
  }
  if (conflicts.length) {
    run.fail(
      `Nothing was written. ${adminPath} overlaps existing routes:\n  ${conflicts.join("\n  ")}\nChoose a free URL with --path /ops/admin.`,
    );
  }
  return { appDir, adminPath, apiPath, warnings };
}

const read = (cwd: string, file: string) =>
  fs.readFile(path.join(cwd, file), "utf8").catch(() => null);

function plannedAuth(modules: InitModules, stubFile: string): AuthOutcome {
  if (modules.authPlan) {
    return { kind: "preset", file: stubFile, provider: modules.authPlan.provider };
  }
  if (modules.sessionStub) {
    return { kind: modules.devAuth ? "dev-stub" : "closed-stub", file: stubFile };
  }
  if (modules.sessionReplacement)
    return { kind: "dev-stub", file: modules.sessionReplacement.file };
  return { kind: "existing" };
}

/** The session module init writes: a provider preset, the stub, or the development identity in place of a stub. */
async function sessionFile(
  modules: InitModules,
  stubFile: string,
): Promise<Record<string, string>> {
  if (modules.authPlan) return { [stubFile]: await renderCall(modules.authPlan) };
  if (modules.sessionStub) {
    return {
      [stubFile]: modules.devAuth
        ? await devSessionStub(stubFile)
        : await tpl("auth-session.ts.txt"),
    };
  }
  const replacement = modules.sessionReplacement;
  return replacement ? { [replacement.file]: replacement.content } : {};
}

const AUTHENTICATION: Record<AuthOutcome["kind"], string> = {
  "dev-stub": "development",
  "closed-stub": "setup-required",
  existing: "existing-helper",
  preset: "preset",
};

/** Every file init writes, as one plan that refuses to overwrite a file init did not write. */
export async function planInit(
  run: InitRun,
  stack: DetectedStack,
  modules: InitModules,
): Promise<InitPlan> {
  const { cwd } = run;
  const { aliasMode, existingConfig } = stack;
  const { adminPath, apiPath, appDir, warnings } = await resolveMount(run, stack);
  if (stack.providerGuessed) warnings.push(PROVIDER_FALLBACK_WARNING);
  if (modules.dialectGuessed) {
    warnings.push(
      "Could not tell from your Drizzle modules whether the database is PostgreSQL, MySQL or SQLite; flowpanel/migrations/0001_init.sql is written for PostgreSQL.",
    );
  }
  for (const warning of warnings) run.ui.warn(warning);
  if (run.framed) run.ui.info(`Admin URL: ${adminPath}`);

  const adminDir = `${appDir}${adminPath}`;
  const pageDir = `${adminDir}/[[...slug]]`;
  const apiDir = `${appDir}${apiPath}/[...route]`;
  const sseDir = `${appDir}${apiPath}/stream`;
  const cssFile = aliasMode === "strip-src" ? "src/styles/admin.css" : "styles/admin.css";
  const cacheComponents = await usesCacheComponents(cwd);
  const configFile = existingConfig
    ? path.relative(cwd, existingConfig.root).split(path.sep).join("/")
    : "flowpanel.config.ts";
  const stubFile = modules.authPlan?.file ?? guessedAuthFile(aliasMode);
  const auth = plannedAuth(modules, stubFile);
  const hostLayout = await findAppLayout(cwd);
  const files: Record<string, string> = {
    [configFile]:
      (existingConfig ? await read(cwd, configFile) : null) ??
      (await renderCall(
        configTemplateCall({
          orm: stack.orm,
          preset: modules.authPlan !== null,
          db: modules.db,
          schema: modules.schema,
          auth: modules.auth,
          appName: modules.appName,
          adminPath,
          apiPath,
          cli: `${stack.pmc.exec} flowpanel`,
          provider: stack.prismaProvider,
          session: modules.sessionStub || modules.sessionReplacement ? "stub" : "own",
        }),
      )),
    [`${pageDir}/page.tsx`]: await adminPageSource(
      configImportFor(pageDir, aliasMode),
      cacheComponents,
    ),
    [`${apiDir}/route.ts`]: await renderCall(
      configImportTemplateCall("api-route.ts.txt", configImportFor(apiDir, aliasMode)),
    ),
    [`${sseDir}/route.ts`]: await renderCall(
      configImportTemplateCall("sse-route.ts.txt", configImportFor(sseDir, aliasMode)),
    ),
    [cssFile]: await tpl("admin.css.txt"),
    [MIGRATION_FILE]:
      (await read(cwd, MIGRATION_FILE)) ?? (await tpl(migrationTemplate(modules.dialect))),
    ...(await sessionFile(modules, stubFile)),
    [`${adminDir}/layout.tsx`]: await renderCall(
      layoutTemplateCall(
        hostLayout !== null,
        modules.appName,
        aliasMode === "none"
          ? path.relative(adminDir, cssFile).split(path.sep).join("/")
          : "@/styles/admin.css",
        cacheComponents,
      ),
    ),
    [`${adminDir}/not-found.tsx`]: await renderCall(
      configImportTemplateCall("admin-not-found.tsx.txt", configImportFor(adminDir, aliasMode)),
    ),
  };

  const expected: Record<string, string> = {};
  const currentPage = await read(cwd, `${pageDir}/page.tsx`);
  if (
    currentPage !== null &&
    (await isGeneratedAdminPage(currentPage, configImportFor(pageDir, aliasMode)))
  ) {
    expected[`${pageDir}/page.tsx`] = currentPage;
  }
  if (modules.sessionReplacement) {
    expected[modules.sessionReplacement.file] = modules.sessionReplacement.expectedContent;
  }
  // Never rewrite the host's root layout, except to add suppressHydrationWarning (ThemeScript needs it).
  let manualHydrationFix: string | null = null;
  if (hostLayout) {
    const source = await fs.readFile(path.join(cwd, hostLayout), "utf8");
    if (/<header[\s>]/.test(source)) {
      warnings.push(HEADER_HINT(hostLayout));
      run.ui.info(HEADER_HINT(hostLayout));
    }
    const patched = patchLayoutWithSuppressHydration(source);
    if (patched) {
      files[hostLayout] = patched;
      expected[hostLayout] = source;
    } else if (!source.includes("suppressHydrationWarning")) {
      manualHydrationFix = hostLayout;
      const message = `Could not add suppressHydrationWarning to ${hostLayout}; add it to <html> by hand.`;
      warnings.push(message);
      if (run.opts.dryRun) run.ui.warn(message);
    }
  }

  const plan = await createFilesystemPlan(
    cwd,
    Object.entries(files).map(([file, content]) => ({
      path: file,
      content,
      ...(expected[file] !== undefined ? { expectedContent: expected[file] } : {}),
    })),
  );
  const conflicts = plan.operations.filter((operation) => operation.kind === "conflict");
  if (conflicts.length > 0) {
    run.fail(conflictMessage(conflicts.map((operation) => operation.path)), {
      applied: false,
      plan: publicPlan(plan),
    });
  }
  return {
    plan,
    adminPath,
    warnings,
    manualHydrationFix,
    auth,
    authentication: auth.kind === "preset" ? `preset:${auth.provider}` : AUTHENTICATION[auth.kind],
  };
}
