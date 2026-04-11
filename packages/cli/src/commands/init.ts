import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateSchema } from "@flowpanel/core";
import kleur from "kleur";
import ora from "ora";
import prompts from "prompts";
import { z } from "zod";
import { detectStack } from "../utils/detect.js";
import { formatSuccess, formatWarning } from "../utils/error-format.js";

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

  // Framework auto-detect
  let framework = "generic";
  if (stack.nextjs) framework = "nextjs";
  else {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
      if (pkg.dependencies?.express) framework = "express";
      else if (pkg.dependencies?.fastify) framework = "fastify";
    } catch {}
  }

  if (!stack.trpc.found) {
    console.error(kleur.red("  ✗ tRPC not detected. FlowPanel requires @trpc/server."));
    console.error(kleur.gray("  Install it: pnpm add @trpc/server @trpc/client"));
    process.exit(1);
  }

  const answers = await prompts(
    [
      {
        type: "text",
        name: "basePath",
        message: "Mount FlowPanel at?",
        initial: "/admin",
      },
      {
        type: "select",
        name: "adapter",
        message: "Database adapter?",
        choices: [
          { title: "Drizzle (PostgreSQL)", value: "drizzle" },
          { title: "Prisma (PostgreSQL)", value: "prisma" },
        ],
      },
      {
        type: "list",
        name: "stages",
        message: "Pipeline stage names?",
        initial: "parse, score, draft, notify",
        separator: ",",
      },
      {
        type: "text",
        name: "timezone",
        message: "Timezone (IANA)? ⚠ Locked after migrate.",
        initial: "UTC",
      },
      {
        type: "text",
        name: "requireRole",
        message: "Who can access the admin panel? (role check expression)",
        initial: `role === "admin"`,
      },
      {
        type: "confirm",
        name: "seedDemo",
        message: "Seed demo data for preview?",
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

  const stages = (answers.stages as string[]).map((s: string) => s.trim()).filter(Boolean);
  const basePath = answers.basePath as string;
  const adapter = (answers.adapter as string) ?? "drizzle";
  const timezone = answers.timezone as string;
  const seedDemo = answers.seedDemo as boolean;

  console.log("\n  Writing files");
  console.log(`  ${"─".repeat(51)}`);

  const configContent = generateFlowPanelConfig({ stages, basePath, timezone, adapter });
  await writeFile(cwd, "flowpanel.config.ts", configContent);
  console.log(formatSuccess("flowpanel.config.ts                        created"));

  const adminPageDir = path.join(cwd, "src", "app", "(dashboard)", basePath.replace(/^\//, ""));
  await fs.mkdir(adminPageDir, { recursive: true });
  const adminPageContent = generateAdminPage(basePath);
  await writeFile(adminPageDir, "page.tsx", adminPageContent);
  console.log(formatSuccess(`src/app/(dashboard)${basePath}/page.tsx         created`));

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
    console.log("\n  Demo data");
    console.log(`  ${"─".repeat(51)}`);
    console.log(formatSuccess("Demo data seeding will run after migration is applied"));
    console.log(kleur.gray("  Run: npx flowpanel migrate"));
  }

  console.log(`\n  ${"─".repeat(51)}`);
  console.log(formatSuccess(`Done\n`));
  console.log(`  Open  ${kleur.cyan(`http://localhost:3000${basePath}`)}\n`);
  console.log(kleur.gray(`  Tip: Need PostgreSQL?`));
  console.log(
    kleur.gray(`  docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16-alpine\n`),
  );
  console.log(kleur.gray("  Next step:  npx flowpanel migrate"));
  console.log(kleur.gray("  Then:       npx flowpanel worker:scan\n"));
}

function generateFlowPanelConfig({
  stages,
  basePath,
  timezone,
  adapter,
}: {
  stages: string[];
  basePath: string;
  timezone: string;
  adapter: string;
}): string {
  const stagesStr = stages.map((s) => `"${s}"`).join(", ");
  const stageFieldsStr = stages.map((s) => `    ${s}: {},`).join("\n");

  const adapterImport =
    adapter === "prisma"
      ? `import { prismaAdapter } from "@flowpanel/adapter-prisma";`
      : `import { drizzleAdapter } from "@flowpanel/adapter-drizzle";`;

  const adapterConfig =
    adapter === "prisma"
      ? `prismaAdapter({\n    client: () => import("@/shared/lib/prisma").then((m) => m.prisma),\n  })`
      : `drizzleAdapter({\n    db: () => import("@/shared/lib/db").then((m) => m.db),\n  })`;

  return `import { defineFlowPanel, z } from "@flowpanel/core";
${adapterImport}

export const flowpanel = defineFlowPanel({
  appName: "my-app",
  timezone: "${timezone}",
  basePath: "${basePath}",

  adapter: ${adapterConfig},

  pipeline: {
    stages: [${stagesStr}] as const,
    fields: {
      userId: z.string().nullable(),
    },
    stageFields: {
${stageFieldsStr}
    },
  },

  security: {
    auth: {
      getSession: async (req) => {
        // TODO: implement using your auth library
        return null;
      },
      requireRole: "admin",
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
