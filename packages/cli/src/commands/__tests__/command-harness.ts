import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Command } from "commander";
import { vi } from "vitest";

export interface CommandRun {
  stdout: string;
  stderr: string;
  exit: number | null;
  dir: string;
}

/** Runs one registered command inside a scratch project, capturing its output and exit code. */
export async function runCommand(
  register: (cli: Command) => void,
  args: string[],
  files: Record<string, string>,
): Promise<CommandRun> {
  const originalCwd = process.cwd();
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "fp-command-")));
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exit: number | null = null;
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    }),
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      exit = code ?? 0;
      throw new Error("exit");
    }) as never),
  ];
  try {
    for (const [file, contents] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
      await fs.writeFile(path.join(dir, file), contents);
    }
    process.chdir(dir);
    const cli = new Command();
    register(cli);
    await cli.parseAsync(["node", "flowpanel", ...args]).catch(() => undefined);
    return { stdout: stdout.join(""), stderr: stderr.join(""), exit, dir };
  } finally {
    process.chdir(originalCwd);
    for (const spy of spies) spy.mockRestore();
    await fs.rm(dir, { recursive: true, force: true });
  }
}
