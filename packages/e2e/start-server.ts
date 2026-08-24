import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prepareDatabase from "./global-setup.js";

async function main() {
  // Playwright starts webServer before globalSetup. Preparing the database here
  // guarantees Next never opens a pool that the reset then terminates underneath
  // it, which otherwise produces noisy 57P01 uncaught exceptions and flaky CI.
  await prepareDatabase();

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const configuredPort = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").port;
  const port = process.env.PORT || configuredPort || "3000";
  const server = spawn("pnpm", ["--filter", "ai-scraper", "dev", "--port", port], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  server.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => server.kill(signal));
  }

  server.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
