import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Command } from "commander";

type CheckResult = { name: string; ok: boolean; detail?: string };

export function doctorCommand(cli: Command): void {
  cli
    .command("doctor")
    .description("Run a health check on FlowPanel setup")
    .action(async () => {
      p.intro(pc.bgBlue(pc.white(" FlowPanel doctor ")));

      const results: CheckResult[] = [];
      results.push(await checkNodeVersion());
      results.push(await checkAdapterDetected());
      results.push(await checkFlowPanelConfig());
      results.push(await checkDrizzleRelations());
      results.push(await checkTailwindPreset());

      printResults(results);

      const failed = results.filter((r) => !r.ok).length;
      p.outro(
        failed === 0
          ? pc.green(`All ${results.length} checks passed`)
          : pc.red(`${failed} check(s) failed`),
      );
      process.exit(failed === 0 ? 0 : 1);
    });
}

function printResults(results: CheckResult[]): void {
  for (const r of results) {
    const icon = r.ok ? pc.green("✓") : pc.red("✗");
    const detail = r.detail ? pc.dim(`  ${r.detail}`) : "";
    console.log(`  ${icon} ${r.name}${detail}`);
  }
}

async function checkNodeVersion(): Promise<CheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1), 10);
  return { name: "Node.js version", ok: major >= 20, detail: version };
}

async function checkAdapterDetected(): Promise<CheckResult> {
  const hasPrisma = await fileExists("prisma/schema.prisma");
  const hasDrizzle =
    (await fileExists("drizzle.config.ts")) || (await fileExists("drizzle.config.js"));
  return {
    name: "ORM adapter",
    ok: hasPrisma || hasDrizzle,
    detail: hasPrisma ? "Prisma detected" : hasDrizzle ? "Drizzle detected" : "No ORM detected",
  };
}

async function checkFlowPanelConfig(): Promise<CheckResult> {
  const candidates = [
    "src/flowpanel.ts",
    "flowpanel.ts",
    "src/app/flowpanel.ts",
    "flowpanel.config.ts",
    "src/flowpanel.config.ts",
  ];
  for (const c of candidates) {
    if (await fileExists(c)) {
      return { name: "FlowPanel config", ok: true, detail: c };
    }
  }
  return {
    name: "FlowPanel config",
    ok: false,
    detail: "No flowpanel.ts / flowpanel.config.ts found",
  };
}

async function checkDrizzleRelations(): Promise<CheckResult> {
  const hasDrizzle = await fileExists("drizzle.config.ts");
  if (!hasDrizzle) return { name: "Drizzle relations", ok: true, detail: "N/A (not Drizzle)" };
  try {
    const { readFileSync } = await import("node:fs");
    const schemaFiles = ["drizzle/schema.ts", "src/db/schema.ts", "src/schema.ts"];
    for (const f of schemaFiles) {
      if (await fileExists(f)) {
        const content = readFileSync(f, "utf-8");
        const hasRelations = content.includes("relations(");
        return {
          name: "Drizzle relations",
          ok: hasRelations,
          detail: hasRelations ? `Found in ${f}` : `No relations() in ${f}`,
        };
      }
    }
    return { name: "Drizzle relations", ok: false, detail: "Schema file not found" };
  } catch {
    return { name: "Drizzle relations", ok: false, detail: "Could not check" };
  }
}

async function checkTailwindPreset(): Promise<CheckResult> {
  try {
    const { readFileSync } = await import("node:fs");
    const candidates = ["tailwind.config.ts", "tailwind.config.js"];
    for (const f of candidates) {
      if (await fileExists(f)) {
        const content = readFileSync(f, "utf-8");
        const hasPreset = content.includes("@flowpanel/react");
        return {
          name: "Tailwind preset",
          ok: hasPreset,
          detail: hasPreset ? "FlowPanel preset configured" : "FlowPanel preset not found",
        };
      }
    }
    return { name: "Tailwind preset", ok: false, detail: "No tailwind.config found" };
  } catch {
    return { name: "Tailwind preset", ok: false, detail: "Could not check" };
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const { access } = await import("node:fs/promises");
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
