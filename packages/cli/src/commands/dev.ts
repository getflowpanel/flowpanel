import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";

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

      // 1. Always spawn `next dev`.
      p.intro(pc.bgCyan(pc.black(" FlowPanel dev ")));
      const next = spawn("pnpm", ["exec", "next", "dev", "--port", opts.port], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      pipeWithPrefix(next, pc.cyan("[next] "));
      children.push(next);

      // 2. Maybe spawn bull-board.
      const wantBoard =
        opts.board !== false &&
        !!process.env.REDIS_URL &&
        (await fileExists(path.join(cwd, "scripts/board-server.ts")));

      if (wantBoard) {
        const board = spawn("pnpm", ["exec", "tsx", "scripts/board-server.ts"], {
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
        });
        pipeWithPrefix(board, pc.magenta("[board] "));
        children.push(board);
      } else if (process.env.REDIS_URL && opts.board !== false) {
        // REDIS_URL set, but no board script — log a hint but don't fail.
        process.stdout.write(
          pc.dim(
            "[flowpanel] REDIS_URL set but scripts/board-server.ts not found — board skipped\n",
          ),
        );
      }

      // Wait for any child to exit; propagate code.
      next.on("exit", (code) => shutdown(code ?? 0));
      if (wantBoard && children[1]) {
        children[1]!.on("exit", (code) => shutdown(code ?? 0));
      }
    });
}

export function pipeWithPrefix(child: ChildProcess, prefix: string): void {
  const onLine =
    (stream: NodeJS.WritableStream) =>
    (chunk: Buffer): void => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.length > 0) stream.write(`${prefix}${line}\n`);
      }
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
