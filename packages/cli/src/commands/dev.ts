import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { detectPackageManager, platformBin, pmCommands } from "../utils/detect";

/** The board entry point, in either module flavour. `.mts` lets a CJS app import ESM statically. */
const BOARD_SCRIPTS = ["scripts/board-server.mts", "scripts/board-server.ts"] as const;

export async function findBoardScript(cwd: string): Promise<string | null> {
  for (const candidate of BOARD_SCRIPTS) {
    if (await fileExists(path.join(cwd, candidate))) return candidate;
  }
  return null;
}

export function devCommand(cli: Command): void {
  cli
    .command("dev")
    .description("Run Next.js dev server (and bull-board if REDIS_URL is set)")
    .option("--port <port>", "Next.js dev port", "3000")
    .option("--no-board", "Skip the bull-board server even if REDIS_URL is set")
    .action(async (opts: { port: string; board: boolean }) => {
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
      const pmc = pmCommands(await detectPackageManager(cwd));
      const runner = platformBin(pmc.exec);
      const next = spawn(runner, pmc.execArgs("next", ["dev", "--port", opts.port]), {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      pipeWithPrefix(next, pc.cyan("[next] "));
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

export function pipeWithPrefix(child: ChildProcess, prefix: string): void {
  const onLine = (stream: NodeJS.WritableStream) => {
    // `pnpm exec <missing-bin>` opens the stream with a bare "undefined" line
    // ahead of its real error. Only that opening line is dropped — everything
    // after it, including a server's own `undefined`, is relayed.
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
