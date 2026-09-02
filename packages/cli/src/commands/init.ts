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
  aliasOf,
  configImportFor,
  detectAppDir,
  detectAuth,
  detectDbClient,
  detectPackageManager,
  detectPathAlias,
  detectSchema,
  detectStack,
  fileExists,
  isSupportedNextVersion,
  type PathAliasMode,
  pmCommands,
} from "../utils/detect";
import { kitCompatibilityError, pinnedSpec } from "../utils/kit";
import { writeJson, writePlanJson } from "../utils/output";
import { tpl } from "../utils/template";
import {
  findAppLayout,
  hasAdminCssImport,
  patchLayoutWithCssImport,
  patchLayoutWithSuppressHydration,
  patchLayoutWithThemeScript,
} from "./init-layout";

interface InitOptions {
  yes?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

export function initErrorPayload(error: string) {
  return { command: "init", applied: false, error } as const;
}

function failInit(opts: InitOptions, message: string): never {
  if (opts.json) writeJson(initErrorPayload(message));
  else p.cancel(message);
  process.exit(1);
}

const REQUIRED_DEPS: ReadonlyArray<{ pkg: string; dev: boolean }> = [
  { pkg: "@flowpanel/kit", dev: false },
  { pkg: "@flowpanel/cli", dev: true },
];

/** Names already present in the host's package.json (deps + devDeps). */
async function readInstalledDeps(cwd: string): Promise<Set<string>> {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

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
    child.stdout?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    child.on("exit", (code) => resolve({ code: code ?? 1, output }));
    child.on("error", (e) => resolve({ code: 1, output: e.message }));
  });
}

/** The last few meaningful lines of a failed install, which is where the cause lives. */
function installFailureReason(output: string): string | null {
  const lines = output
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  return lines.slice(-8).join("\n");
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
    .action(async (opts: InitOptions) => {
      if (!opts.json) p.intro(pc.bgCyan(pc.black(" FlowPanel init ")));

      const cwd = process.cwd();
      const unattended = opts.yes || opts.dryRun || opts.json;

      if (!unattended && !process.stdin.isTTY) {
        failInit(
          opts,
          "init asks questions and this run has no interactive terminal. Re-run with --yes to accept the detected defaults.",
        );
      }

      const pm = await detectPackageManager(cwd);
      const pmc = pmCommands(pm);
      const stack = await detectStack(cwd);

      if (!stack.nextjs) {
        failInit(
          opts,
          `Next.js not detected in package.json. Install it first: ${pmc.addDisplay("next react react-dom", false)}`,
        );
      }
      if (!isSupportedNextVersion(stack.nextjs)) {
        failInit(
          opts,
          `FlowPanel requires Next.js ^16.3.0. Upgrade first: ${pmc.addDisplay(
            "next@^16.3.0 react@^19 react-dom@^19",
            false,
          )}`,
        );
      }
      if (!stack.drizzle && !stack.prisma) {
        failInit(
          opts,
          `No ORM detected. Install one: ${pmc.addDisplay("drizzle-orm", false)}  (or ${pmc.addDisplay("@prisma/client prisma", false)}).`,
        );
      }

      const kitMismatch = await kitCompatibilityError(cwd);
      if (kitMismatch) {
        failInit(opts, kitMismatch);
      }

      const orm: "drizzle" | "prisma" = stack.drizzle ? "drizzle" : "prisma";

      const parts = [
        stack.nextjs ? `Next.js ${stack.nextjs}` : null,
        stack.typescript ? "TypeScript" : null,
        stack.drizzle ? "Drizzle" : null,
        stack.prisma ? "Prisma" : null,
        stack.tailwind ? `Tailwind ${stack.tailwindMajor ?? ""}` : null,
      ].filter(Boolean) as string[];
      if (!opts.json) p.note(parts.join(" · "), "Detected stack");

      if (!stack.tailwind && !unattended) {
        const proceed = await p.confirm({
          message:
            "Tailwind not found in package.json. The admin scaffold needs Tailwind to render. Continue anyway?",
          initialValue: false,
        });
        if (p.isCancel(proceed) || !proceed) {
          p.cancel(
            `Aborted — nothing was written. Install Tailwind first: ${pmc.addDisplay(
              "tailwindcss postcss autoprefixer",
              true,
            )}`,
          );
          process.exit(1);
        }
      }

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

      let db = defaults.db;
      let schemaPath = defaults.schema;
      let auth = defaults.auth;
      let appName = defaults.appName;

      if (unattended && guessed.length > 0 && !opts.json) {
        p.log.warn(
          `Nothing matched these in your project, so the config imports a guess:\n  ${guessed.join(
            "\n  ",
          )}\nEdit flowpanel.config.ts, or re-run without --yes to be asked.`,
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
          initialValue: defaults.db,
        });
        if (p.isCancel(dbAns)) {
          p.cancel("Aborted — nothing was written.");
          process.exit(1);
        }
        db = dbAns;

        if (orm === "drizzle") {
          const schemaAns = await p.text({
            message: "Drizzle schema path",
            initialValue: defaults.schema,
          });
          if (p.isCancel(schemaAns)) {
            p.cancel("Aborted — nothing was written.");
            process.exit(1);
          }
          schemaPath = schemaAns;
        }

        const authAns = await p.text({
          message: "Auth helper path (must export getSession)",
          initialValue: defaults.auth,
        });
        if (p.isCancel(authAns)) {
          p.cancel("Aborted — nothing was written.");
          process.exit(1);
        }
        auth = authAns;
      }

      const configTemplate =
        orm === "prisma" ? "flowpanel.config.prisma.ts.txt" : "flowpanel.config.drizzle.ts.txt";

      const isV3 = stack.tailwindMajor === 3;
      const adminCssTemplate = isV3 ? "admin.css.v3.txt" : "admin.css.txt";

      const cssRel = aliasMode === "strip-src" ? "src/styles/admin.css" : "styles/admin.css";
      // admin.css.txt's `@source` paths are relative to the CSS file itself,
      // which lands one level deeper on strip-src (`src/styles/`) than on
      // root/none (`styles/`) — compute the right number of `../` segments
      // back to the app root instead of hardcoding a single depth.
      const cssSourceUp = `${"../".repeat(cssRel.split("/").length - 1)}`;

      const appDir = await detectAppDir(cwd);

      const adminPageDir = `${appDir}/admin/[[...slug]]`;
      const apiRouteDir = `${appDir}/api/flowpanel/[...route]`;
      const sseRouteDir = `${appDir}/api/flowpanel/stream`;

      const files: Record<string, string> = {
        "flowpanel.config.ts": await tpl(configTemplate, {
          DB: db,
          SCHEMA: schemaPath,
          AUTH: auth,
          APP_NAME: appName,
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
        [cssRel]: await tpl(adminCssTemplate, { SOURCE_UP: cssSourceUp }),
        "flowpanel/migrations/0001_init.sql": await tpl("migration.sql.txt"),
      };

      if (isV3 && !(await fileExists(path.join(cwd, "tailwind.config.ts")))) {
        files["tailwind.config.ts"] = await tpl("tailwind.config.v3.ts.txt");
      }

      // Nothing on disk exports getSession, so the config above imports a path
      // that has to be created too — otherwise every later step dies on it.
      const sessionStub = detected.auth === null && auth === guesses.auth;
      const sessionStubFile = guessedAuthFile(aliasMode);
      if (sessionStub) files[sessionStubFile] = await tpl("dev-session.ts.txt");

      const existingLayout = await findAppLayout(cwd);
      // Without an alias the layout's relative import must climb out of the
      // app dir, which is one level deeper when the App Router lives in src/.
      const cssImportSpec =
        aliasMode === "none"
          ? `${"../".repeat(appDir.split("/").length)}${cssRel}`
          : "@/styles/admin.css";
      let layoutNote: "scaffolded" | "patched" | "kept" | "kept-has-css" = "scaffolded";
      let keptLayoutPath = "";

      if (!existingLayout) {
        files[`${appDir}/layout.tsx`] = await tpl("app-layout.tsx.txt", {
          APP_NAME: appName,
          CSS_IMPORT: cssImportSpec,
        });
      }

      const intents: FileIntent[] = Object.entries(files).map(([file, content]) => ({
        path: file,
        content,
      }));

      if (existingLayout) {
        const layoutFull = path.join(cwd, existingLayout);
        const src = await fs.readFile(layoutFull, "utf8");
        const withCss = patchLayoutWithCssImport(src, cssImportSpec);
        const withHydration = patchLayoutWithSuppressHydration(withCss ?? src);
        const withTheme = patchLayoutWithThemeScript(withHydration ?? withCss ?? src);
        const changes: string[] = [];
        if (withCss) changes.push("the admin stylesheet import");
        if (withHydration) changes.push("suppressHydrationWarning");
        if (withTheme) changes.push("the pre-hydration theme script");

        if (changes.length > 0)
          intents.push({
            path: existingLayout,
            content: withTheme ?? withHydration ?? withCss ?? src,
            expectedContent: src,
          });

        if (withCss) layoutNote = "patched";
        else if (hasAdminCssImport(src)) layoutNote = "kept";
        else {
          layoutNote = "kept-has-css";
          keptLayoutPath = existingLayout;
        }
      }

      const plan = await createFilesystemPlan(cwd, intents);
      const conflicts = plan.operations.filter((operation) => operation.kind === "conflict");
      if (conflicts.length > 0) {
        if (opts.json) writePlanJson("init", plan, false);
        else {
          p.cancel(
            `Nothing was written. FlowPanel will not overwrite files it does not own:\n  ${conflicts
              .map((operation) => operation.path)
              .join(
                "\n  ",
              )}\nMove them, merge the generated changes manually, or run doctor for details.`,
          );
        }
        process.exit(1);
      }

      if (opts.dryRun) {
        if (opts.json) writePlanJson("init", plan, false);
        else {
          const preview = publicPlan(plan);
          p.note(
            preview.operations
              .map((operation) => `${operation.kind.padEnd(6)} ${operation.path}`)
              .join("\n"),
            "Filesystem plan (no changes applied)",
          );
          p.outro(pc.dim("Dry run complete."));
        }
        return;
      }

      const writtenPaths = await applyFilesystemPlan(plan);
      if (!opts.json && writtenPaths.length > 0) p.note(writtenPaths.join("\n"), "Wrote");

      const installed = await readInstalledDeps(cwd);
      const missing = REQUIRED_DEPS.filter((d) => !installed.has(d.pkg));
      let depsOk = true;
      if (missing.length > 0) {
        const names = missing.map((d) => pinnedSpec(d.pkg)).join(", ");
        // A spinner in a pipe floods CI logs with ANSI redraw frames.
        const depSpinner = !opts.json && process.stdout.isTTY ? p.spinner() : null;
        if (depSpinner) depSpinner.start(`Installing ${names} with ${pm}`);
        else if (!opts.json) p.log.step(`Installing ${names} with ${pm}…`);
        let installOk = true;
        let failureOutput = "";
        for (const { pkg, dev } of missing) {
          const result = await runInstall(pm, pmc.add(pinnedSpec(pkg), dev), cwd);
          if (result.code !== 0) {
            installOk = false;
            failureOutput = result.output;
            break;
          }
        }
        if (installOk) {
          if (depSpinner) depSpinner.stop(`Installed ${names}`);
          else if (!opts.json) p.log.success(`Installed ${names}`);
        } else {
          depsOk = false;
          if (depSpinner) depSpinner.stop("Dependency install failed");
          else if (!opts.json) p.log.error("Dependency install failed");
          const reason = installFailureReason(failureOutput);
          if (!opts.json) {
            if (reason) p.note(reason, `${pm} said`);
            p.note(
              missing.map((d) => pmc.addDisplay(pinnedSpec(d.pkg), d.dev)).join("\n"),
              "Install these manually, then run the steps below",
            );
          }
        }
      }

      const outroLines = [
        "Next:",
        `  ${pc.cyan(`${pmc.exec} flowpanel migrate`)}  ${pc.dim("— create audit + tracking tables")}`,
        `  ${pc.cyan(`${pmc.run} dev`)}  ${pc.dim("— start Next.js")}`,
        `  Open ${pc.cyan("http://localhost:3000/admin")}  ${pc.dim(
          `— scaffolded under ${appDir}/`,
        )}`,
      ];
      if (!depsOk) {
        outroLines.unshift(
          `${pc.yellow("⚠ init incomplete")} — install the dependencies above first, then:`,
          "",
        );
        process.exitCode = 1;
      }
      if (sessionStub) {
        outroLines.push(
          "",
          `  ${pc.yellow("!")} No auth module found — wrote a development ${pc.cyan("getSession")} stub`,
          `    at ${pc.cyan(sessionStubFile)}. It signs every request in as an admin.`,
          `    Replace it with your real provider before production.`,
        );
      }
      if (layoutNote === "kept-has-css") {
        outroLines.push(
          "",
          `  ${pc.yellow("!")} Your ${pc.cyan(keptLayoutPath)} already imports a CSS bundle.`,
          `    Add ${pc.cyan(`import "${cssImportSpec}";`)} to it (or import the FlowPanel`,
          `    stylesheet from your existing global CSS file) so the admin renders styled.`,
        );
      }
      if (isV3) {
        outroLines.push(
          "",
          `  ${pc.dim("Tailwind v3 detected — wrote tailwind.config.ts mirroring FlowPanel tokens.")}`,
        );
      }
      if (opts.json) {
        writeJson({
          command: "init",
          applied: true,
          dependenciesInstalled: depsOk,
          plan: publicPlan(plan),
        });
      } else p.outro(outroLines.join("\n"));
    });
}
