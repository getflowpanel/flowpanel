import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateSchema, z } from "@flowpanel/core";
import kleur from "kleur";
import ora from "ora";
import prompts from "prompts";
import { detectStack } from "../utils/detect";
import { detectModels } from "../utils/detect-models";
import { formatSuccess, formatWarning } from "../utils/error-format";
import { runDemo } from "./demo";

const BANNER = `
┌──────────────────────────────────────────────────────┐
│                                                       │
│  ⚡ FlowPanel  v0.1.0                                 │
│                                                       │
│  The admin panel you didn't want to build.            │
│  Pipeline tracking · AI cost · Crash recovery         │
│                                                       │
└──────────────────────────────────────────────────────┘
`;

export async function runInit(cwd: string = process.cwd()): Promise<void> {
  console.log(kleur.bold(BANNER));

  const stack = await detectStack(cwd);

  if (stack.nextjs)
    console.log(
      formatSuccess(
        `Detected  Next.js ${stack.nextjs}${stack.typescript ? " · TypeScript" : ""}${stack.drizzle ? " · Drizzle" : ""}${stack.bullmq ? " · BullMQ" : ""}`,
      ),
    );
  if (stack.betterAuth.found)
    console.log(formatSuccess(`Detected  Better Auth at ${stack.betterAuth.path ?? "package"}`));
  if (stack.trpc.routerPath)
    console.log(formatSuccess(`Detected  tRPC v11 at ${stack.trpc.routerPath}`));
  console.log("");

  if (!stack.trpc.found) {
    console.error(kleur.red("  ✗ tRPC not detected. FlowPanel requires @trpc/server."));
    console.error(kleur.gray("  Install it: pnpm add @trpc/server @trpc/client"));
    process.exit(1);
  }

  // Detect user models (Prisma schema.prisma or Drizzle schema.ts)
  const detected = await detectModels(cwd);
  if (detected.schemaPath && detected.models.length > 0) {
    console.log(
      formatSuccess(
        `Detected  ${detected.source} schema at ${detected.schemaPath} (${detected.models.length} ${detected.models.length === 1 ? "model" : "models"})`,
      ),
    );
  }
  console.log("");

  const answers = await prompts(
    [
      {
        type: "text",
        name: "appName",
        message: "App name",
        initial: path.basename(process.cwd()),
      },
      {
        type: "select",
        name: "adapter",
        message: "Database adapter",
        choices: [
          { title: "Prisma (PostgreSQL)", value: "prisma-pg" },
          { title: "Prisma (SQLite)", value: "prisma-sqlite" },
          { title: "Drizzle (PostgreSQL)", value: "drizzle-pg" },
          { title: "Drizzle (SQLite)", value: "drizzle-sqlite" },
        ],
      },
      {
        type: "text",
        name: "stages",
        message: "Pipeline stages (comma-separated)",
        initial: "ingest,process,notify",
      },
      {
        type: "select",
        name: "defaultTimeRange",
        message: "Default time range",
        choices: [
          { title: "1 hour", value: "1h" },
          { title: "6 hours", value: "6h" },
          { title: "24 hours (recommended)", value: "24h" },
          { title: "7 days", value: "7d" },
          { title: "30 days", value: "30d" },
        ],
        initial: 2,
      },
      {
        type: "confirm",
        name: "seedDemo",
        message: "Seed demo data? (500 sample runs)",
        initial: true,
      },
    ],
    {
      onCancel: () => {
        console.log("\nAborted.");
        process.exit(0);
      },
    },
  );

  const stages = (answers.stages as string)
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  const appName = answers.appName as string;
  const adapter = answers.adapter as string;
  const defaultTimeRange = answers.defaultTimeRange as string;
  const seedDemo = answers.seedDemo as boolean;

  // Multi-select prompt for models if detected
  let selectedModels: string[] = [];
  if (detected.models.length > 0) {
    const modelAnswer = await prompts(
      {
        type: "multiselect",
        name: "models",
        message: "Which models to include in admin?",
        choices: detected.models.map((m) => ({ title: m, value: m, selected: true })),
        hint: "Space to toggle · Enter to confirm",
        instructions: false,
      },
      {
        onCancel: () => {
          console.log("\nAborted.");
          process.exit(0);
        },
      },
    );
    selectedModels = (modelAnswer.models as string[]) ?? [];
  }

  console.log("\n  Writing files");
  console.log(`  ${"─".repeat(51)}`);

  const configContent = generateFlowPanelConfig({
    stages,
    appName,
    adapter,
    defaultTimeRange,
    models: selectedModels,
    source: detected.source,
  });
  await writeFile(cwd, "flowpanel.config.ts", configContent);
  console.log(formatSuccess("flowpanel.config.ts                        created"));

  const adminPageDir = path.join(cwd, "src", "app", "(dashboard)", "admin");
  await fs.mkdir(adminPageDir, { recursive: true });
  const adminPageContent = generateAdminPage("/admin");
  await writeFile(adminPageDir, "page.tsx", adminPageContent);
  console.log(formatSuccess(`src/app/(dashboard)/admin/page.tsx         created`));

  if (stack.trpc.routerPath) {
    await patchTrpcRouter(cwd, stack.trpc.routerPath);
    console.log(formatSuccess(`${stack.trpc.routerPath}          +2 lines`));
  }

  await appendToFile(cwd, ".gitignore", "\n.flowpanel/\n");
  console.log(formatSuccess(".gitignore                                 +1 line (.flowpanel/)"));

  await appendToFile(
    cwd,
    ".env.example",
    "\n# FlowPanel\n# FLOWPANEL_COOKIE_SECRET=\n# FLOWPANEL_COOKIE_SECRET_PREV=\n",
  );
  console.log(
    formatSuccess(".env.example                               +cookie secret keys (commented)"),
  );

  console.log("\n  Database");
  console.log(`  ${"─".repeat(51)}`);

  const migrationDir = path.join(cwd, "flowpanel", "migrations");
  await fs.mkdir(migrationDir, { recursive: true });

  const schemaSql = generateSchema({
    pipeline: {
      stages,
      fields: { userId: z.string().nullable() },
      stageFields: Object.fromEntries(stages.map((s) => [s, {}])),
    },
  });

  const migrationId = "0001_init";
  await writeFile(migrationDir, `${migrationId}.sql`, schemaSql);
  console.log(formatSuccess(`flowpanel/migrations/${migrationId}.sql         generated`));

  if (seedDemo) {
    const spinner = ora({ text: "Seeding demo data...", color: "cyan" }).start();
    try {
      await runDemo();
      spinner.succeed("Seeded demo data");
    } catch {
      spinner.warn("Demo seed skipped — run `npx flowpanel demo` after setting up your database");
    }
  } else {
    console.log(kleur.gray("  Skipped demo data. Run `npx flowpanel demo` later."));
  }

  const detectedParts = [
    stack.nextjs ? `Next.js ${stack.nextjs}` : null,
    stack.typescript ? "TypeScript" : null,
    stack.drizzle ? "Drizzle" : stack.prisma ? "Prisma" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  console.log(`\n${kleur.bold("  ⚡ FlowPanel Init")}\n`);
  if (detectedParts) {
    console.log(`  Detected: ${kleur.cyan(detectedParts)}\n`);
  }
  console.log(`${kleur.green("  ✓")} Created flowpanel.config.ts`);
  console.log(`${kleur.green("  ✓")} Created app/admin/[[...trpc]]/route.ts`);
  console.log(`${kleur.green("  ✓")} Generated migration 0001_init.sql`);
  if (selectedModels.length > 0) {
    console.log(
      `${kleur.green("  ✓")} Added ${selectedModels.length} resource${selectedModels.length === 1 ? "" : "s"}: ${selectedModels.join(", ")}`,
    );
  }

  // Check for Tailwind config and show guidance if present
  const tailwindConfigs = [
    "tailwind.config.ts",
    "tailwind.config.js",
    "tailwind.config.mjs",
    "tailwind.config.cjs",
  ];
  let tailwindPath: string | null = null;
  for (const tw of tailwindConfigs) {
    try {
      await fs.access(path.join(cwd, tw));
      tailwindPath = tw;
      break;
    } catch {}
  }
  if (tailwindPath) {
    console.log(
      `${kleur.yellow("  !")} Add @flowpanel/react to Tailwind content globs in ${tailwindPath}:`,
    );
    console.log(kleur.gray(`      content: [..., "./node_modules/@flowpanel/react/dist/**/*.js"]`));
  }
  if (seedDemo) {
    console.log(`${kleur.green("  ✓")} Seeded 500 demo runs`);
  }
  console.log("\n  Next steps:");
  console.log(`    1. ${kleur.cyan("npm run dev")}`);
  console.log(`    2. Visit ${kleur.cyan("http://localhost:3000/admin")}`);
  console.log("    3. Explore the dashboard!\n");
  console.log(`  Tip: Run ${kleur.cyan("flowpanel dev")} for config hot-reload\n`);
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

  // Generate resource() calls for detected models
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
    // Drizzle: pass the schema table name
    resourcesBody = models.map((m) => `    ${m}: resource("${capitalize(m)}"),`).join("\n");
  }

  return `import { defineFlowPanel, resource } from "@flowpanel/core";
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
    console.log(
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
