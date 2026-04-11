import { exec } from "node:child_process";
import kleur from "kleur";
import { startDemoServer } from "../demo/server.js";
import { createSSESimulation } from "../demo/mock-router.js";

interface DemoOptions {
  port: number;
  clear: boolean;
  open: boolean;
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} ${url}`);
}

export async function runDemo(opts: DemoOptions): Promise<void> {
  if (opts.clear) {
    const { runDemoClear } = await import("./demo-clear.js");
    await runDemoClear();
    return;
  }

  const port = opts.port;

  console.log(kleur.bold().cyan("\n  ◆ FlowPanel v0.1.0\n"));
  console.log(kleur.gray(`  Starting demo server on port ${port}...\n`));

  const { close } = await startDemoServer(port);
  const url = `http://localhost:${port}`;

  console.log(kleur.green(`  ✓ Demo server ready: ${kleur.bold(url)}`));
  console.log(kleur.gray(`  API: ${url}/api/trpc/*`));
  console.log(kleur.gray(`  SSE: ${url}/api/trpc/flowpanel.stream.connect\n`));
  console.log(kleur.gray("  Press Ctrl+C to stop\n"));

  if (opts.open) {
    openBrowser(url);
  }

  const sse = createSSESimulation();
  const interval = setInterval(() => {
    const event = sse.generateEvent();
    const now = formatTime(new Date());
    const data = event.data as Record<string, unknown>;
    const id = `#${data.id}`;

    if (event.event === "run.created") {
      const stage = (data.stage as string).padEnd(10);
      console.log(
        `  ${kleur.gray(now)}  ${kleur.cyan("run.created")}   ${kleur.bold(id.padEnd(7))}  ${kleur.magenta(stage)}  ${data.partition_key}`,
      );
    } else if (event.event === "run.finished") {
      const status = data.status as string;
      const durationMs = data.durationMs as number;
      const marker =
        status === "ok"
          ? kleur.green(`${formatDuration(durationMs)} ✓`)
          : kleur.red(`${formatDuration(durationMs)} ✗`);
      console.log(
        `  ${kleur.gray(now)}  ${kleur.yellow("run.finished")}  ${kleur.bold(id.padEnd(7))}             ${marker}`,
      );
    }
  }, 3000);

  await new Promise<void>((resolve) => {
    const shutdown = () => {
      clearInterval(interval);
      close();
      console.log(kleur.gray("\n  Demo server stopped.\n"));
      resolve();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}
