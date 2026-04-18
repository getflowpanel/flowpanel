import { execFile } from "node:child_process";
import { watch } from "node:fs";
import { platform } from "node:os";
import { resolve } from "node:path";
import kleur from "kleur";
import { loadConfig } from "../loadConfig";

export async function runDev(opts: { port?: string }) {
  console.log(kleur.bold("\n  ⚡ FlowPanel dev server\n"));

  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (err) {
    console.error(kleur.red(`  Config error: ${err}`));
    process.exit(1);
  }

  const port = opts.port ?? "3000";
  const basePath = config.config.basePath ?? "/admin";

  console.log(`  Dashboard:  ${kleur.cyan(`http://localhost:${port}${basePath}`)}`);
  console.log(`  Config:     ${kleur.gray("flowpanel.config.ts")} (watching)`);
  console.log(`  Stages:     ${kleur.gray(config.config.pipeline?.stages?.join(", ") ?? "none")}`);
  console.log(
    `  Metrics:    ${kleur.gray(`${String(Object.keys(config.config.metrics ?? {}).length)} configured`)}`,
  );
  console.log(
    `  Drawers:    ${kleur.gray(`${String(Object.keys(config.config.drawers ?? {}).length)} configured`)}`,
  );
  console.log(`\n  Watching for config changes... (Ctrl+C to stop)\n`);

  // Best-effort browser open
  const url = `http://localhost:${port}${basePath}`;
  const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  execFile(cmd, [url], () => {});

  // Watch config file — node:fs.watch is native in Node 22. Debounced to coalesce
  // multiple "change" events that editors fire during save (e.g. atomic replace).
  const configPath = resolve("flowpanel.config.ts");
  let debounceTimer: NodeJS.Timeout | null = null;

  const watcher = watch(configPath, (eventType) => {
    if (eventType !== "change") return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const time = new Date().toLocaleTimeString("en", { hour12: false });
      console.log(`  ${kleur.gray(time)} Config changed — revalidating...`);
      try {
        const newConfig = await loadConfig();
        console.log(
          `  ${kleur.green("✓")} Config valid (${newConfig.config.pipeline?.stages?.length ?? 0} stages, ${Object.keys(newConfig.config.metrics ?? {}).length} metrics)`,
        );
        console.log(`           Run ${kleur.cyan("flowpanel migrate:gen")} if schema changed\n`);
      } catch (err) {
        console.log(`  ${kleur.red("✗")} Config error: ${err}\n`);
      }
    }, 100);
  });

  // Clean shutdown
  process.on("SIGINT", () => {
    watcher.close();
    process.exit(0);
  });
}
