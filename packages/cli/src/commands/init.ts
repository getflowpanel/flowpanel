import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import {
  detectAppDir,
  detectAuth,
  detectDbClient,
  detectPathAlias,
  detectSchema,
  detectStack,
  fileExists,
} from "../utils/detect.js";
import { tpl } from "../utils/template.js";

interface InitOptions {
  yes?: boolean;
}

/**
 * Returns the path (relative to `cwd`) of an existing `app/layout.tsx`, or
 * `null` if the project does not have one yet. Checks both `app/` (root) and
 * `src/app/` — Next.js supports either as the App Router root.
 */
async function findAppLayout(cwd: string): Promise<string | null> {
  for (const rel of ["app/layout.tsx", "src/app/layout.tsx"]) {
    if (await fileExists(path.join(cwd, rel))) return rel;
  }
  return null;
}

const ADMIN_CSS_IMPORT_RE = /["']@\/styles\/admin\.css["']|["']\.{1,2}\/.*styles\/admin\.css["']/;

/**
 * Inserts `import "<spec>";` at the top of an existing layout file. Returns
 * the patched source if a change is needed, or `null` if the file already
 * imports the admin stylesheet.
 */
function patchLayoutWithCssImport(src: string, importSpec: string): string | null {
  if (ADMIN_CSS_IMPORT_RE.test(src)) return null;
  // If the file already imports another CSS bundle (e.g. globals.css), the
  // host owns its own theme — leave the file alone and let the outro tell
  // the user where to add the FlowPanel import.
  if (/import\s+["'][^"']+\.css["']/.test(src)) return null;
  return `import "${importSpec}";\n${src}`;
}

export function initCommand(cli: Command): void {
  cli
    .command("init")
    .description("Initialize FlowPanel in this project")
    .option("--yes", "Accept detected defaults without prompting (CI mode)")
    .action(async (opts: InitOptions) => {
      p.intro(pc.bgCyan(pc.black(" FlowPanel init ")));

      const cwd = process.cwd();
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

      // Drizzle wins if both are installed (rare, but possible during migration).
      const orm: "drizzle" | "prisma" = stack.drizzle ? "drizzle" : "prisma";

      const parts = [
        stack.nextjs ? `Next.js ${stack.nextjs}` : null,
        stack.typescript ? "TypeScript" : null,
        stack.drizzle ? "Drizzle" : null,
        stack.prisma ? "Prisma" : null,
        stack.tailwind ? `Tailwind ${stack.tailwindMajor ?? ""}` : null,
      ].filter(Boolean) as string[];
      p.note(parts.join(" · "), "Detected stack");

      // If Tailwind is absent the scaffold will render unstyled. Warn loudly
      // and offer to bail so the user installs it before continuing.
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
      const defaults = {
        db:
          (await detectDbClient(cwd, aliasMode)) ??
          (orm === "prisma" ? "@/lib/prisma" : "@/server/lib/db"),
        schema: (await detectSchema(cwd, aliasMode)) ?? "@/server/lib/db/schema",
        auth: (await detectAuth(cwd, aliasMode)) ?? "@/server/lib/auth",
        appName: path.basename(cwd),
      };

      let db = defaults.db;
      let schemaPath = defaults.schema;
      let auth = defaults.auth;
      let appName = defaults.appName;

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

      // Tailwind branch:
      //   v4 (or unknown — assume modern install): admin.css uses `@theme {}`
      //     and registers utilities directly. No tailwind.config.ts needed.
      //   v3: admin.css can't use `@theme`; ship the v3 token sheet and a
      //     hand-mirrored `tailwind.config.ts` so utilities like `bg-fp-bg-1`
      //     resolve. Mirrors `examples/freelance-radar/tailwind.config.ts`.
      const isV3 = stack.tailwindMajor === 3;
      const adminCssTemplate = isV3 ? "admin.css.v3.txt" : "admin.css.txt";

      // Where the admin stylesheet lands depends on the project's path
      // alias. For `strip-src` projects (`@/*` → `src/*`) we drop it under
      // `src/styles/` so `@/styles/admin.css` resolves correctly. For `root`
      // (`@/*` → `./*`) and `none` we put it at the project root.
      const cssRel = aliasMode === "strip-src" ? "src/styles/admin.css" : "styles/admin.css";

      // Detect whether this project uses `app/` (repo root) or `src/app/`
      // for its App Router root. Scaffold the admin page + API routes
      // beneath whichever one is in use so the user doesn't have to move
      // them after init.
      const appDir = await detectAppDir(cwd);

      const files: Record<string, string> = {
        "flowpanel.config.ts": await tpl(configTemplate, {
          DB: db,
          SCHEMA: schemaPath,
          AUTH: auth,
          APP_NAME: appName,
        }),
        [`${appDir}/admin/[[...slug]]/page.tsx`]: await tpl("admin-page.tsx.txt"),
        [`${appDir}/api/flowpanel/[...route]/route.ts`]: await tpl("api-route.ts.txt"),
        [`${appDir}/api/flowpanel/stream/route.ts`]: await tpl("sse-route.ts.txt"),
        [cssRel]: await tpl(adminCssTemplate),
        "flowpanel/migrations/0001_init.sql": await tpl("migration.sql.txt"),
      };

      if (isV3 && !(await fileExists(path.join(cwd, "tailwind.config.ts")))) {
        files["tailwind.config.ts"] = await tpl("tailwind.config.v3.ts.txt");
      }

      // Layout handling: prefer the existing one (root or src/app). If none
      // exists, scaffold a minimal layout that imports styles/admin.css. If a
      // layout exists but does not yet import any CSS bundle, prepend the
      // FlowPanel import; otherwise we leave it untouched and the outro
      // points the user at the right import.
      const existingLayout = await findAppLayout(cwd);
      // For both `strip-src` (CSS at `src/styles/admin.css`, alias `@/*` →
      // `src/*`) and `root` (CSS at `styles/admin.css`, alias `@/*` → `./*`)
      // the user-facing import string is the same `@/styles/admin.css`. With
      // no alias we emit a relative path from `app/layout.tsx`.
      const cssImportSpec = aliasMode === "none" ? "../styles/admin.css" : "@/styles/admin.css";
      let layoutNote: "scaffolded" | "patched" | "kept" | "kept-has-css" = "scaffolded";

      if (!existingLayout) {
        files[`${appDir}/layout.tsx`] = await tpl("app-layout.tsx.txt", {
          APP_NAME: appName,
          CSS_IMPORT: cssImportSpec,
        });
      }

      const spinner = p.spinner();
      spinner.start("Writing files");
      let written = 0;
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
        written++;
      }

      // Patch the host's existing layout, if any, to add the admin CSS import.
      if (existingLayout) {
        const layoutFull = path.join(cwd, existingLayout);
        const src = await fs.readFile(layoutFull, "utf8");
        // When the existing layout sits under `src/app/`, the CSS import
        // needs to be relative-from-src-app or use the alias unchanged. The
        // `@/styles/admin.css` alias works for both `strip-src` and `root`
        // (and `none` already uses a relative path).
        const patched = patchLayoutWithCssImport(src, cssImportSpec);
        if (patched) {
          await fs.writeFile(layoutFull, patched, "utf8");
          written++;
          layoutNote = "patched";
        } else if (ADMIN_CSS_IMPORT_RE.test(src)) {
          layoutNote = "kept";
        } else {
          layoutNote = "kept-has-css";
        }
      }

      spinner.stop(`${written} written, ${skipped} skipped`);

      const outroLines = [
        "Next:",
        `  ${pc.cyan("pnpm flowpanel migrate")}  ${pc.dim("— create audit + tracking tables")}`,
        `  ${pc.cyan("pnpm dev")}               ${pc.dim("— start Next.js")}`,
        `  Open ${pc.cyan("http://localhost:3000/admin")}  ${pc.dim(
          `— scaffolded under ${appDir}/`,
        )}`,
      ];
      if (layoutNote === "kept-has-css") {
        outroLines.push(
          "",
          `  ${pc.yellow("!")} Your ${pc.cyan(existingLayout!)} already imports a CSS bundle.`,
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
