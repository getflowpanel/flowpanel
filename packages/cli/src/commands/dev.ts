import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { connect, createServer } from "node:net";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { readAdminMount } from "../utils/admin-path";
import { PNP_UNSUPPORTED } from "../utils/compatibility";
import { detectPackageManager, platformBin, pmCommands } from "../utils/detect";
import { inspectDependency } from "../utils/project-packages";
import { noNextProject } from "../utils/project-root";
import { failCommand } from "../utils/ui";

/** The board entry point, in either module flavour. `.mts` lets a CJS app import ESM statically. */
const BOARD_SCRIPTS = ["scripts/board-server.mts", "scripts/board-server.ts"] as const;

export async function findBoardScript(cwd: string): Promise<string | null> {
  for (const candidate of BOARD_SCRIPTS) {
    if (await fileExists(path.join(cwd, candidate))) return candidate;
  }
  return null;
}

function answers(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", (error: NodeJS.ErrnoException) => resolve(error.code !== "EADDRINUSE"));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

/** Free only when nothing answers on IPv4 or IPv6 loopback: a server bound to one address still owns localhost. */
export async function isPortFree(port: number): Promise<boolean> {
  const [v4, v6] = await Promise.all([answers("127.0.0.1", port), answers("::1", port)]);
  return !v4 && !v6 && (await canListen(port));
}

/** The project's own `next` binary, or why `next dev` cannot start here. */
export async function devPreflight(
  cwd: string,
  port: string,
): Promise<{ nextBin: string } | { error: string }> {
  const notProject = await noNextProject(cwd);
  if (notProject) return { error: notProject };
  const next = await inspectDependency(cwd, "next");
  if (next.error === "pnp-only") return { error: PNP_UNSUPPORTED };
  if (next.installed === null) {
    const pm = await detectPackageManager(cwd);
    return {
      error: `Next.js is not installed in ${cwd}. Run \`${pm} install\`, then start again.`,
    };
  }
  const bin = next.installed.manifest.bin;
  const entry = typeof bin === "string" ? bin : bin?.next;
  if (typeof entry !== "string") {
    return {
      error: `The next installed in ${cwd} has no next binary. Reinstall your dependencies.`,
    };
  }
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    return { error: `--port must be a number from 1 to 65535. Got "${port}".` };
  }
  if (!(await isPortFree(Number(port)))) {
    return { error: `Port ${port} is in use. Pass --port <other>.` };
  }
  return { nextBin: path.resolve(next.installed.directory, entry) };
}

/** Runs the resolved `next` with node, so no package manager can go looking for another one. */
export function startNext(cwd: string, nextBin: string, port: string): ChildProcess {
  return spawn(process.execPath, [nextBin, "dev", "--port", port], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

export function devCommand(cli: Command): void {
  cli
    .command("dev")
    .description("Run next dev, plus the queue board when REDIS_URL is set")
    .option("--port <port>", "Next.js dev port (default: 3000)")
    .option("--no-board", "Skip the queue board (bull-board) even if REDIS_URL is set")
    .action(async (options: { port?: string; board: boolean }) => {
      const opts = { ...options, port: options.port ?? "3000" };
      const cwd = process.cwd();
      const children: ChildProcess[] = [];

      function shutdown(code: number): void {
        for (const c of children) {
          if (!c.killed) c.kill("SIGTERM");
        }
        process.exit(code);
      }
      process.on("SIGINT", () => shutdown(0));
      process.on("SIGTERM", () => shutdown(0));

      p.intro(pc.bgCyan(pc.black(" FlowPanel dev ")));
      const preflight = await devPreflight(cwd, opts.port);
      if ("error" in preflight) failCommand("dev", false, preflight.error);
      const pmc = pmCommands(await detectPackageManager(cwd));
      const runner = platformBin(pmc.exec);
      const next = startNext(cwd, preflight.nextBin, opts.port);
      const mount = await readAdminMount(cwd);
      const adminUrl = `http://localhost:${opts.port}${mount.path ?? "/admin"}`;
      pipeWithPrefix(next, pc.cyan("[next] "), (line) => {
        if (/\bReady in\b/.test(line)) process.stdout.write(`${pc.green("Admin:")} ${adminUrl}\n`);
      });
      children.push(next);

      const boardScript = opts.board === false ? null : await findBoardScript(cwd);
      const wantBoard = !!process.env.REDIS_URL && boardScript !== null;

      if (wantBoard && boardScript) {
        const board = spawn(runner, pmc.execArgs("tsx", [boardScript]), {
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
        });
        pipeWithPrefix(board, pc.magenta("[board] "));
        children.push(board);
      } else if (process.env.REDIS_URL && opts.board !== false) {
        process.stdout.write(
          pc.dim(
            `[flowpanel] REDIS_URL set but ${BOARD_SCRIPTS.join(" / ")} not found — board skipped\n`,
          ),
        );
      }

      next.on("exit", (code) => shutdown(code ?? 0));
      const board = children[1];
      if (wantBoard && board) {
        board.on("exit", (code) => shutdown(code ?? 0));
      }
    });
}

export function pipeWithPrefix(
  child: ChildProcess,
  prefix: string,
  onStdoutLine?: (line: string) => void,
): void {
  const onLine = (stream: NodeJS.WritableStream) => {
    // Only the bare "undefined" line `pnpm exec <missing-bin>` opens the stream with is dropped.
    let opened = false;
    return (chunk: Buffer): void => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.length === 0) continue;
        if (!opened) {
          opened = true;
          if (line.trim() === "undefined") continue;
        }
        stream.write(`${prefix}${line}\n`);
        if (stream === process.stdout) onStdoutLine?.(line);
      }
    };
  };
  child.stdout?.on("data", onLine(process.stdout));
  child.stderr?.on("data", onLine(process.stderr));
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
