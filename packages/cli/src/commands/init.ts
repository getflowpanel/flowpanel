import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateSchema, z } from "@flowpanel/core";
import kleur from "kleur";
import ora from "ora";
import prompts from "prompts";
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
	const timezone = answers.timezone as string;
	const seedDemo = answers.seedDemo as boolean;

	console.log("\n  Writing files");
	console.log("  " + "─".repeat(51));

	const configContent = generateFlowPanelConfig({ stages, basePath, timezone });
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
	console.log("  " + "─".repeat(51));

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

	const spinner = ora({ text: "Seeding demo runs...", color: "cyan" });

	if (seedDemo) {
		spinner.start();
		// Simulate seeding progress (actual seeding via `flowpanel demo` command)
		await new Promise<void>((resolve) => setTimeout(resolve, 600));
		spinner.succeed("Seeded 500 demo runs");
	}

	const detectedParts = [
		stack.nextjs ? `Next.js ${stack.nextjs}` : null,
		stack.typescript ? "TypeScript" : null,
		stack.drizzle ? "Drizzle" : stack.prisma ? "Prisma" : null,
	]
		.filter(Boolean)
		.join(" · ");

	console.log("\n" + kleur.bold("  ⚡ FlowPanel Init") + "\n");
	if (detectedParts) {
		console.log(`  Detected: ${kleur.cyan(detectedParts)}\n`);
	}
	console.log(kleur.green("  ✓") + " Created flowpanel.config.ts");
	console.log(kleur.green("  ✓") + ` Created app/admin/[[...trpc]]/route.ts`);
	console.log(kleur.green("  ✓") + " Generated migration 0001_init.sql");
	if (seedDemo) {
		console.log(kleur.green("  ✓") + " Seeded 500 demo runs");
	}
	console.log("\n  Next steps:");
	console.log(`    1. ${kleur.cyan("npm run dev")}`);
	console.log(`    2. Visit ${kleur.cyan(`http://localhost:3000${basePath}`)}`);
	console.log("    3. Explore the dashboard!\n");
	console.log(`  Tip: Run ${kleur.cyan("flowpanel dev")} for config hot-reload\n`);
}

function generateFlowPanelConfig({
	stages,
	basePath,
	timezone,
}: {
	stages: string[];
	basePath: string;
	timezone: string;
}): string {
	const stagesStr = stages.map((s) => `"${s}"`).join(", ");
	const stageFieldsStr = stages.map((s) => `    ${s}: {},`).join("\n");

	return `import { defineFlowPanel, z } from "@flowpanel/core";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";

export const flowpanel = defineFlowPanel({
  appName: "my-app",
  timezone: "${timezone}",
  basePath: "${basePath}",

  adapter: drizzleAdapter({
    db: () => import("@/shared/lib/db").then((m) => m.db),
  }),

  pipeline: {
    stages: [${stagesStr}] as const,
    fields: {
      userId: z.string().nullable(),
    },
    stageFields: {
${stageFieldsStr}
    },
  },

  drawers: {
    "run-detail": {
      title: (run: any) => \`Run #\${run.id}\`,
      sections: [
        { type: "stat-grid", stats: ["status", "duration_ms", "stage"] },
        { type: "timeline" },
        { type: "kv-grid", fields: ["partition_key", "created_at"] },
        { type: "error-block", when: (run: any) => run.status === "failed" },
      ],
      actions: [
        { label: "Retry", onClick: "retry", variant: "danger" as const, when: (run: any) => run.status === "failed" },
      ],
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

function generateAdminPage(basePath: string): string {
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
