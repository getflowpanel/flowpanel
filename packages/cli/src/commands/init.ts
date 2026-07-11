// LOC-OK: init command — one cohesive scaffolding flow (detect adapter, write
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import {
  configImportFor,
  detectAppDir,
  detectAuth,
  detectDbClient,
  detectPackageManager,
  detectPathAlias,
  detectSchema,
  detectStack,
  fileExists,
  pmCommands,
} from "../utils/detect.js";
import { tpl } from "../utils/template.js";

interface InitOptions {
  yes?: boolean;
}

async function findAppLayout(cwd: string): Promise<string | null> {
  for (const rel of ["app/layout.tsx", "src/app/layout.tsx"]) {
    if (await fileExists(path.join(cwd, rel))) return rel;
  }
  return null;
}

const ADMIN_CSS_IMPORT_RE = /["']@\/styles\/admin\.css["']|["']\.{1,2}\/.*styles\/admin\.css["']/;

/** Inserts `import "<spec>";` at the top of an existing layout file. */
function patchLayoutWithCssImport(src: string, importSpec: string): string | null {
  if (ADMIN_CSS_IMPORT_RE.test(src)) return null;
  if (/import\s+["'][^"']+\.css["']/.test(src)) return null;
  return `import "${importSpec}";\n${src}`;
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

export function initCommand(cli: Command): void {
  cli
    .command("init")
    .description("Initialize FlowPanel in this project")
    .option("--yes", "Accept detected defaults without prompting (CI mode)")
    .action(async (opts: InitOptions) => {
      p.intro(pc.bgCyan(pc.black(" FlowPanel init ")));

      const cwd = process.cwd();
      const pm = await detectPackageManager(cwd);
      const pmc = pmCommands(pm);
      const stack = await detectStack(cwd);

      if (!stack.nextjs) {
        p.cancel(
          "Next.js not detected in package.json. Install it first: pnpm add next react react-dom",
        );
        process.exit(1);
      }
      if (!stack.drizzle && !stack.prisma) {
        p.cancel(
          "No ORM detected. Install one: pnpm add drizzle-orm  (or pnpm add @prisma/client prisma).",
        );
        process.exit(1);
      }

      const orm: "drizzle" | "prisma" = stack.drizzle ? "drizzle" : "prisma";

      const parts = [
        stack.nextjs ? `Next.js ${stack.nextjs}` : null,
        stack.typescript ? "TypeScript" : null,
        stack.drizzle ? "Drizzle" : null,
        stack.prisma ? "Prisma" : null,
        stack.tailwind ? `Tailwind ${stack.tailwindMajor ?? ""}` : null,
      ].filter(Boolean) as string[];
      p.note(parts.join(" · "), "Detected stack");

      if (!stack.tailwind && !opts.yes) {
        const proceed = await p.confirm({
          message:
            "Tailwind not found in package.json. The admin scaffold needs Tailwind to render. Continue anyway?",
          initialValue: false,
        });
        if (p.isCancel(proceed) || !proceed) {
          p.cancel("Aborted. Install Tailwind first: pnpm add -D tailwindcss postcss autoprefixer");
          process.exit(0);
        }
      }

      const aliasMode = await detectPathAlias(cwd);
      const detected = {
        db: await detectDbClient(cwd, aliasMode),
        schema: await detectSchema(cwd, aliasMode),
        auth: await detectAuth(cwd, aliasMode),
      };
      const defaults = {
        db: detected.db ?? (orm === "prisma" ? "@/lib/prisma" : "@/server/lib/db"),
        schema: detected.schema ?? "@/server/lib/db/schema",
        auth: detected.auth ?? "@/server/lib/auth",
        appName: path.basename(cwd),
      };
      const guessed = [
        detected.db === null ? `db client   ${defaults.db}` : null,
        orm === "drizzle" && detected.schema === null ? `schema      ${defaults.schema}` : null,
        detected.auth === null ? `getSession  ${defaults.auth}` : null,
      ].filter(Boolean) as string[];

      let db = defaults.db;
      let schemaPath = defaults.schema;
      let auth = defaults.auth;
      let appName = defaults.appName;

      if (opts.yes && guessed.length > 0) {
        p.log.warn(
          `Nothing matched these in your project, so the config imports a guess:\n  ${guessed.join(
            "\n  ",
          )}\nEdit flowpanel.config.ts, or re-run without --yes to be asked.`,
        );
      }

      if (!opts.yes) {
        const appNameAns = await p.text({
          message: "App name",
          initialValue: defaults.appName,
        });
        if (p.isCancel(appNameAns)) {
          p.cancel("Aborted.");
          process.exit(0);
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
          p.cancel("Aborted.");
          process.exit(0);
        }
        db = dbAns;

        if (orm === "drizzle") {
          const schemaAns = await p.text({
            message: "Drizzle schema path",
            initialValue: defaults.schema,
          });
          if (p.isCancel(schemaAns)) {
            p.cancel("Aborted.");
            process.exit(0);
          }
          schemaPath = schemaAns;
        }

        const authAns = await p.text({
          message: "Auth helper path (must export getSession)",
          initialValue: defaults.auth,
        });
        if (p.isCancel(authAns)) {
          p.cancel("Aborted.");
          process.exit(0);
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

      const existingLayout = await findAppLayout(cwd);
      const cssImportSpec = aliasMode === "none" ? "../styles/admin.css" : "@/styles/admin.css";
      let layoutNote: "scaffolded" | "patched" | "kept" | "kept-has-css" = "scaffolded";
      let keptLayoutPath = "";

      if (!existingLayout) {
        files[`${appDir}/layout.tsx`] = await tpl("app-layout.tsx.txt", {
          APP_NAME: appName,
          CSS_IMPORT: cssImportSpec,
        });
      }

      const spinner = p.spinner();
      spinner.start("Writing files");
      const writtenPaths: string[] = [];
      let skipped = 0;

      for (const [rel, content] of Object.entries(files)) {
        const full = path.join(cwd, rel);
        if (await fileExists(full)) {
          if (!opts.yes) {
            spinner.stop(`${rel} exists`);
            const overwrite = await p.confirm({
              message: `${rel} already exists — overwrite?`,
              initialValue: false,
            });
            if (p.isCancel(overwrite) || !overwrite) {
              skipped++;
              spinner.start("Writing files");
              continue;
            }
            spinner.start("Writing files");
          } else {
            skipped++;
            continue;
          }
        }
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, content, "utf8");
        writtenPaths.push(rel);
      }

      if (existingLayout) {
        const layoutFull = path.join(cwd, existingLayout);
        const src = await fs.readFile(layoutFull, "utf8");
        const patched = patchLayoutWithCssImport(src, cssImportSpec);
        if (patched) {
          await fs.writeFile(layoutFull, patched, "utf8");
          writtenPaths.push(`${existingLayout} (added the admin stylesheet import)`);
          layoutNote = "patched";
        } else if (ADMIN_CSS_IMPORT_RE.test(src)) {
          layoutNote = "kept";
        } else {
          layoutNote = "kept-has-css";
          keptLayoutPath = existingLayout;
        }
      }

      spinner.stop(
        skipped > 0
          ? `${writtenPaths.length} written, ${skipped} skipped (already present)`
          : `${writtenPaths.length} written`,
      );
      if (writtenPaths.length > 0) p.note(writtenPaths.join("\n"), "Wrote");

      const installed = await readInstalledDeps(cwd);
      const missing = REQUIRED_DEPS.filter((d) => !installed.has(d.pkg));
      let depsOk = true;
      if (missing.length > 0) {
        const names = missing.map((d) => d.pkg).join(", ");
        const depSpinner = p.spinner();
        depSpinner.start(`Installing ${names} with ${pm}`);
        let installOk = true;
        let failureOutput = "";
        for (const { pkg, dev } of missing) {
          const result = await runInstall(pm, pmc.add(pkg, dev), cwd);
          if (result.code !== 0) {
            installOk = false;
            failureOutput = result.output;
            break;
          }
        }
        if (installOk) {
          depSpinner.stop(`Installed ${names}`);
        } else {
          depsOk = false;
          depSpinner.stop("Dependency install failed");
          const reason = installFailureReason(failureOutput);
          if (reason) p.note(reason, `${pm} said`);
          p.note(
            missing.map((d) => pmc.addDisplay(d.pkg, d.dev)).join("\n"),
            "Install these manually, then run the steps below",
          );
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
      p.outro(outroLines.join("\n"));
    });
}
