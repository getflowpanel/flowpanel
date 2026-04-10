import * as fs from "node:fs";
import * as path from "node:path";
import kleur from "kleur";

export async function runDev(): Promise<void> {
  const configPath = path.resolve("flowpanel.config.ts");

  console.log(kleur.bold("\n  FlowPanel Dev Mode\n"));

  // Initial validation
  await validateConfig(configPath);

  console.log(kleur.gray("  Watching flowpanel.config.ts for changes...\n"));
  console.log(kleur.gray("  Press Ctrl+C to stop.\n"));

  // Watch config file for changes
  const watcher = fs.watch(configPath, { persistent: true }, async (eventType) => {
    if (eventType === "change") {
      console.log(kleur.cyan("\n  Config changed, re-validating..."));
      await validateConfig(configPath);
    }
  });

  // Handle shutdown
  process.on("SIGINT", () => {
    watcher.close();
    console.log(kleur.gray("\n  Dev mode stopped.\n"));
    process.exit(0);
  });
}

async function validateConfig(configPath: string): Promise<void> {
  try {
    const { loadConfig } = await import("../loadConfig.js");
    const config = await loadConfig(configPath);

    const stages = (config as any).pipeline?.stages ?? [];
    const metrics = Object.keys((config as any).metrics ?? {});
    const tabs = ((config as any).tabs ?? []).length;

    console.log(kleur.green("  ✓ Config valid"));
    console.log(kleur.gray(`    Stages: ${stages.join(", ")}`));
    console.log(kleur.gray(`    Metrics: ${metrics.length} defined`));
    console.log(kleur.gray(`    Tabs: ${tabs} configured`));
  } catch (err) {
    console.log(kleur.red(`  ✗ Config error: ${(err as Error).message}`));
  }
}
