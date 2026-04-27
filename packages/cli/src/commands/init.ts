import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import { generateSchema, z } from "@flowpanel/core";
import type { Command } from "commander";
import pc from "picocolors";
import { detectStack } from "../utils/detect";
import { detectModels } from "../utils/detect-models";
import { formatWarning } from "../utils/error-format";

export function initCommand(cli: Command): void {
  cli
    .command("init")
    .description("Initialize FlowPanel in this project")
    .option("--adapter <name>", "Force adapter: prisma | drizzle")
    .option("--models <list>", "Comma-separated model names to include")
    .option("--yes", "Skip prompts (CI mode)")
    .action(async (options: { adapter?: string; models?: string; yes?: boolean }) => {
      p.intro(pc.bgBlue(pc.white(" FlowPanel init ")));

      const cwd = process.cwd();
      const stack = await detectStack(cwd);

      const detectedParts: string[] = [];
      if (stack.nextjs) detectedParts.push(`Next.js ${stack.nextjs}`);
      if (stack.typescript) detectedParts.push("TypeScript");
      if (stack.drizzle) detectedParts.push("Drizzle");
      if (stack.bullmq) detectedParts.push("BullMQ");
      if (stack.betterAuth.found) detectedParts.push("Better Auth");
      if (stack.trpc.found) detectedParts.push("tRPC");

      if (detectedParts.length > 0) {
        p.note(detectedParts.join(" · "), "Detected stack");
      }

      if (!stack.trpc.found) {
        p.cancel(
          pc.red("tRPC not detected. FlowPanel requires @trpc/server.\n") +
            pc.dim("Install it: pnpm add @trpc/server @trpc/client"),
        );
        process.exit(1);
      }

      const detected = await detectModels(cwd);
      if (detected.schemaPath && detected.models.length > 0) {
        p.log.success(
          `${detected.source} schema at ${detected.schemaPath} (${detected.models.length} ${detected.models.length === 1 ? "model" : "models"})`,
        );
      }

      let appName = path.basename(cwd);
      let adapter = options.adapter ?? (stack.drizzle ? "drizzle-pg" : "prisma-pg");
      let stages = ["ingest", "process", "notify"];
      let defaultTimeRange = "24h";
      let selectedModels: string[] = options.models
        ? options.models
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean)
        : [];

      if (!options.yes) {
        const appNameAnswer = await p.text({
          message: "App name",
          initialValue: appName,
        });
        if (p.isCancel(appNameAnswer)) {
          p.cancel("Aborted.");
          process.exit(0);
        }
        appName = appNameAnswer as string;

        if (!options.adapter) {
          const adapterAnswer = await p.select({
            message: "Database adapter",
            options: [
              { label: "Prisma (PostgreSQL)", value: "prisma-pg" },
              { label: "Prisma (SQLite)", value: "prisma-sqlite" },
              { label: "Drizzle (PostgreSQL)", value: "drizzle-pg" },
              { label: "Drizzle (SQLite)", value: "drizzle-sqlite" },
            ],
          });
          if (p.isCancel(adapterAnswer)) {
            p.cancel("Aborted.");
            process.exit(0);
          }
          adapter = adapterAnswer as string;
        }

        const stagesAnswer = await p.text({
          message: "Pipeline stages (comma-separated)",
          initialValue: stages.join(","),
        });
        if (p.isCancel(stagesAnswer)) {
          p.cancel("Aborted.");
          process.exit(0);
        }
        stages = (stagesAnswer as string)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const timeRangeAnswer = await p.select({
          message: "Default time range",
          options: [
            { label: "1 hour", value: "1h" },
            { label: "6 hours", value: "6h" },
            { label: "24 hours (recommended)", value: "24h" },
            { label: "7 days", value: "7d" },
            { label: "30 days", value: "30d" },
          ],
        });
        if (p.isCancel(timeRangeAnswer)) {
          p.cancel("Aborted.");
          process.exit(0);
        }
        defaultTimeRange = timeRangeAnswer as string;

        if (!options.models && detected.models.length > 0) {
          const modelsAnswer = await p.multiselect({
            message: "Which models to include in admin?",
            options: detected.models.map((m) => ({ label: m, value: m })),
            initialValues: detected.models,
            required: false,
          });
          if (p.isCancel(modelsAnswer)) {
            p.cancel("Aborted.");
            process.exit(0);
          }
          selectedModels = modelsAnswer as string[];
        }
      }

      const s = p.spinner();
      s.start("Writing files...");

      const configContent = generateFlowPanelConfig({
        stages,
        appName,
        adapter,
        defaultTimeRange,
        models: selectedModels,
        source: detected.source,
      });
      await writeFile(cwd, "flowpanel.config.ts", configContent);

      const adminPageDir = path.join(cwd, "src", "app", "(dashboard)", "admin");
      await fs.mkdir(adminPageDir, { recursive: true });
      const adminPageContent = generateAdminPage("/admin");
      await writeFile(adminPageDir, "page.tsx", adminPageContent);

      if (stack.trpc.routerPath) {
        await patchTrpcRouter(cwd, stack.trpc.routerPath);
      }

      await appendToFile(cwd, ".gitignore", "\n.flowpanel/\n");
      await appendToFile(
        cwd,
        ".env.example",
        "\n# FlowPanel\n# FLOWPANEL_COOKIE_SECRET=\n# FLOWPANEL_COOKIE_SECRET_PREV=\n",
      );

      const migrationDir = path.join(cwd, "flowpanel", "migrations");
      await fs.mkdir(migrationDir, { recursive: true });

      const schemaSql = generateSchema({
        pipeline: {
          stages,
          fields: { userId: z.string().nullable() },
          stageFields: Object.fromEntries(stages.map((st) => [st, {}])),
        },
      });

      const migrationId = "0001_init";
      await writeFile(migrationDir, `${migrationId}.sql`, schemaSql);

      s.stop("Files written");

      p.log.success("flowpanel.config.ts — created");
      p.log.success("src/app/(dashboard)/admin/page.tsx — created");
      p.log.success(`flowpanel/migrations/${migrationId}.sql — generated`);
      if (stack.trpc.routerPath) {
        p.log.success(`${stack.trpc.routerPath} — patched`);
      }
      if (selectedModels.length > 0) {
        p.log.success(
          `Added ${selectedModels.length} resource${selectedModels.length === 1 ? "" : "s"}: ${selectedModels.join(", ")}`,
        );
      }

      // Tailwind hint
      const tailwindConfigs = [
        "tailwind.config.ts",
        "tailwind.config.js",
        "tailwind.config.mjs",
        "tailwind.config.cjs",
      ];
      for (const tw of tailwindConfigs) {
        try {
          await fs.access(path.join(cwd, tw));
          p.log.warn(
            `Add @flowpanel/react to Tailwind content globs in ${tw}:\n` +
              pc.dim(`  content: [..., "./node_modules/@flowpanel/react/dist/**/*.js"]`),
          );
          break;
        } catch {}
      }

      p.outro(
        pc.green("Done! ") +
          pc.dim("Next: ") +
          pc.cyan("npm run dev") +
          pc.dim(" → visit ") +
          pc.cyan("http://localhost:3000/admin"),
      );
    });
}

function generateFlowPanelConfig({
  stages,
  appName,
  adapter,
  defaultTimeRange,
  models,
  source,
}: {
  stages: string[];
  appName: string;
  adapter: string;
  defaultTimeRange: string;
  models: string[];
  source: "prisma" | "drizzle" | null;
}): string {
  const stagesStr = stages.map((s) => `"${s}"`).join(", ");
  const stageFieldsStr = stages.map((s) => `    ${s}: {},`).join("\n");

  const adapterImport = adapter.startsWith("prisma")
    ? `import { prismaAdapter } from "@flowpanel/adapter-prisma";`
    : `import { drizzleAdapter } from "@flowpanel/adapter-drizzle";`;

  const adapterConfig = adapter.startsWith("prisma")
    ? `prismaAdapter({ prisma: db })`
    : `drizzleAdapter({ db: () => import("@/shared/lib/db").then((m) => m.db) })`;

  let resourcesBody: string;
  if (models.length === 0) {
    resourcesBody = `    // Add your models here, e.g.:
    // user: resource(prisma.user),
    // post: resource(prisma.post, {
    //   columns: [(p) => p.title, (p) => p.author.name, (p) => p.status],
    //   filters: [(p) => p.status],
    // }),`;
  } else if (source === "prisma") {
    resourcesBody = models
      .map((m) => `    ${camelCase(m)}: resource(db.${camelCase(m)}),`)
      .join("\n");
  } else {
    resourcesBody = models.map((m) => `    ${m}: resource("${capitalize(m)}"),`).join("\n");
  }

  return `import "server-only";
import { defineFlowPanel, resource } from "@flowpanel/core";
${adapterImport}

export const flowpanel = defineFlowPanel({
  appName: "${appName}",
  timezone: "UTC",
  basePath: "/admin",

  adapter: ${adapterConfig},

  // Resources
  resources: {
${resourcesBody}
  },

  // Pipeline (optional — for background job tracking)
  pipeline: {
    stages: [${stagesStr}] as const,
    fields: {},
    stageFields: {
${stageFieldsStr}
    },
  },

  security: {
    auth: {
      getSession: async (_req) => ({
        _flowpanelStub: true as const,
        id: "dev",
        role: "admin",
        email: "dev@localhost",
      }),
    },
  },
});
`;
}

function generateAdminPage(_basePath: string): string {
  return `import { FlowPanelUI } from "@flowpanel/react";
import { flowpanel } from "@root/flowpanel.config";

export default function AdminPage() {
  return <FlowPanelUI config={flowpanel} />;
}
`;
}

async function patchTrpcRouter(cwd: string, routerPath: string): Promise<void> {
  const fullPath = path.join(cwd, routerPath);
  try {
    let content = await fs.readFile(fullPath, "utf8");
    if (content.includes("flowpanel:router")) return;

    content =
      `import { createFlowPanelRouter } from "@flowpanel/core/trpc";\nimport { flowpanel } from "@root/flowpanel.config";\n` +
      content;
    content = content.replace(
      /export const appRouter = .+?\.router\(\{/s,
      (match) =>
        match +
        `\n  // flowpanel:router\n  flowpanel: createFlowPanelRouter({ t, config: flowpanel, getRequest: (ctx) => ctx.req }),`,
    );
    await fs.writeFile(fullPath, content, "utf8");
  } catch {
    console.warn(
      formatWarning(`Could not auto-patch ${routerPath}. Add flowpanel router manually.`),
    );
  }
}

async function writeFile(dir: string, filename: string, content: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), content, "utf8");
}

async function appendToFile(cwd: string, filename: string, content: string): Promise<void> {
  const fullPath = path.join(cwd, filename);
  try {
    await fs.appendFile(fullPath, content, "utf8");
  } catch {
    await fs.writeFile(fullPath, content, "utf8");
  }
}

function camelCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
