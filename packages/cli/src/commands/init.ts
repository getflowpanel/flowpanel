import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import {
  detectAuth,
  detectDbClient,
  detectSchema,
  detectStack,
  fileExists,
} from "../utils/detect.js";
import { tpl } from "../utils/template.js";

interface InitOptions {
  yes?: boolean;
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

      const defaults = {
        db: (await detectDbClient(cwd)) ?? (orm === "prisma" ? "@/lib/prisma" : "@/server/lib/db"),
        schema: (await detectSchema(cwd)) ?? "@/server/lib/db/schema",
        auth: (await detectAuth(cwd)) ?? "@/server/lib/auth",
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

      const files: Record<string, string> = {
        "flowpanel.config.ts": await tpl(configTemplate, {
          DB: db,
          SCHEMA: schemaPath,
          AUTH: auth,
          APP_NAME: appName,
        }),
        "app/admin/[[...slug]]/page.tsx": await tpl("admin-page.tsx.txt"),
        "app/api/flowpanel/[...route]/route.ts": await tpl("api-route.ts.txt"),
        "app/api/flowpanel/stream/route.ts": await tpl("sse-route.ts.txt"),
        "styles/admin.css": await tpl("admin.css.txt"),
        "flowpanel/migrations/0001_init.sql": await tpl("migration.sql.txt"),
      };

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
      spinner.stop(`${written} written, ${skipped} skipped`);

      p.outro(
        [
          "Next:",
          `  ${pc.cyan("pnpm flowpanel migrate")}  ${pc.dim("— create audit + tracking tables")}`,
          `  ${pc.cyan("pnpm dev")}               ${pc.dim("— start Next.js")}`,
          `  Open ${pc.cyan("http://localhost:3000/admin")}`,
        ].join("\n"),
      );
    });
}
