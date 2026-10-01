import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PNP_UNSUPPORTED } from "../../utils/compatibility";
import { devPreflight, findBoardScript, isPortFree, pipeWithPrefix, startNext } from "../dev";

function fakeChild(): { child: ChildProcess; stdout: EventEmitter; stderr: EventEmitter } {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  return { child: { stdout, stderr } as unknown as ChildProcess, stdout, stderr };
}

function capture(fn: () => void): { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const outSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    out.push(String(chunk));
    return true;
  });
  const errSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    err.push(String(chunk));
    return true;
  });
  try {
    fn();
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
  return { out, err };
}

describe("dev command module", () => {
  it("imports without throwing", async () => {
    await expect(import("../dev")).resolves.toBeDefined();
  });

  it("pipeWithPrefix is exported", async () => {
    const mod = await import("../dev");
    expect(typeof mod.pipeWithPrefix).toBe("function");
  });
});

describe("pipeWithPrefix", () => {
  it("prefixes each non-empty line", () => {
    const { child, stdout } = fakeChild();
    const { out } = capture(() => {
      pipeWithPrefix(child, "[next] ");
      stdout.emit("data", Buffer.from("ready in 1.2s\n\nLocal: http://localhost:3000\n"));
    });
    expect(out).toEqual(["[next] ready in 1.2s\n", "[next] Local: http://localhost:3000\n"]);
  });

  // Verbatim from `pnpm exec next dev` in a project without next installed:
  // a bare "undefined" on stderr, then pnpm's real error.
  it("drops the bare `undefined` line `pnpm exec` opens stderr with", () => {
    const { child, stderr } = fakeChild();
    const { err } = capture(() => {
      pipeWithPrefix(child, "[next] ");
      stderr.emit(
        "data",
        Buffer.from('undefined\n ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "next" not found\n'),
      );
    });
    expect(err).toEqual(['[next]  ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "next" not found\n']);
  });

  it("relays a later bare `undefined` — a user's console.log must not vanish", () => {
    const { child, stdout, stderr } = fakeChild();
    const { out, err } = capture(() => {
      pipeWithPrefix(child, "[next] ");
      stderr.emit("data", Buffer.from("undefined\nERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL\n"));
      stderr.emit("data", Buffer.from("undefined\n"));
      stdout.emit("data", Buffer.from("ready in 1.2s\n"));
      stdout.emit("data", Buffer.from("undefined\n"));
    });
    expect(err).toEqual(["[next] ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL\n", "[next] undefined\n"]);
    expect(out).toEqual(["[next] ready in 1.2s\n", "[next] undefined\n"]);
  });

  it("keeps a bare `undefined` that arrives later inside the opening chunk", () => {
    const { child, stdout } = fakeChild();
    const { out } = capture(() => {
      pipeWithPrefix(child, "[next] ");
      stdout.emit("data", Buffer.from("ready in 1.2s\nundefined\n"));
    });
    expect(out).toEqual(["[next] ready in 1.2s\n", "[next] undefined\n"]);
  });

  it("tracks the opening line per stream", () => {
    const { child, stdout, stderr } = fakeChild();
    const { out, err } = capture(() => {
      pipeWithPrefix(child, "[board] ");
      stdout.emit("data", Buffer.from("undefined\nlistening on 3001\n"));
      stderr.emit("data", Buffer.from("undefined\nboom\n"));
    });
    expect(out).toEqual(["[board] listening on 3001\n"]);
    expect(err).toEqual(["[board] boom\n"]);
  });
});

describe("findBoardScript", () => {
  it("finds the ESM board script a CJS app needs to import the adapter statically", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-board-mts-"));
    try {
      await fs.mkdir(path.join(tmp, "scripts"), { recursive: true });
      await fs.writeFile(path.join(tmp, "scripts/board-server.mts"), "");
      expect(await findBoardScript(tmp)).toBe("scripts/board-server.mts");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("still finds the .ts script projects scaffolded before", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-board-ts-"));
    try {
      await fs.mkdir(path.join(tmp, "scripts"), { recursive: true });
      await fs.writeFile(path.join(tmp, "scripts/board-server.ts"), "");
      expect(await findBoardScript(tmp)).toBe("scripts/board-server.ts");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("reports none when neither exists", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-board-none-"));
    try {
      expect(await findBoardScript(tmp)).toBeNull();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("devPreflight", () => {
  async function project(files: Record<string, string>): Promise<string> {
    const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "fp-dev-")));
    for (const [file, contents] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
      await fs.writeFile(path.join(dir, file), contents);
    }
    return dir;
  }

  const DECLARED = JSON.stringify({
    dependencies: { next: "16.3.4" },
    packageManager: "pnpm@10.33.0",
  });
  const NEXT_BIN =
    'require("node:fs").writeFileSync("argv.log", JSON.stringify(process.argv.slice(2)));\n';
  const INSTALLED = {
    "node_modules/next/package.json": JSON.stringify({
      name: "next",
      version: "16.3.4",
      bin: { next: "dist/bin/next" },
    }),
    "node_modules/next/dist/bin/next": NEXT_BIN,
  };

  async function busyPort(): Promise<{ port: number; close: () => Promise<void> }> {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { port, close: () => new Promise((resolve) => server.close(() => resolve())) };
  }

  async function preflight(files: Record<string, string>, port = "3000") {
    const dir = await project(files);
    try {
      return { dir, result: await devPreflight(dir, port) };
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  it("names the directory outside a Next.js project", async () => {
    const { dir, result } = await preflight({});
    expect(result).toEqual({
      error: `No Next.js project found in ${dir}. Run this from your project root.`,
    });
  });

  it("asks for an install instead of falling through to a package-manager download", async () => {
    const { dir, result } = await preflight({ "package.json": DECLARED });
    expect(result).toEqual({
      error: `Next.js is not installed in ${dir}. Run \`pnpm install\`, then start again.`,
    });
  });

  it("gives a Yarn PnP project the PnP message, not an install hint", async () => {
    const { result } = await preflight({ "package.json": DECLARED, ".pnp.cjs": "" });
    expect(result).toEqual({ error: PNP_UNSUPPORTED });
  });

  it("stops when the installed next has no binary", async () => {
    const { result } = await preflight({
      "package.json": DECLARED,
      "node_modules/next/package.json": JSON.stringify({ name: "next", version: "16.3.4" }),
    });
    expect(result).toMatchObject({ error: expect.stringContaining("has no next binary") });
  });

  it("says which port is taken and how to pick another", async () => {
    const taken = await busyPort();
    try {
      const { result } = await preflight(
        { "package.json": DECLARED, ...INSTALLED },
        String(taken.port),
      );
      expect(result).toEqual({ error: `Port ${taken.port} is in use. Pass --port <other>.` });
    } finally {
      await taken.close();
    }
  });

  it("rejects a port that is not a number", async () => {
    const files = { "package.json": DECLARED, ...INSTALLED };
    expect((await preflight(files, "abc")).result).toEqual({
      error: '--port must be a number from 1 to 65535. Got "abc".',
    });
    expect((await preflight(files, "70000")).result).toMatchObject({
      error: expect.stringContaining("--port must be a number"),
    });
  });

  it("returns the project's own next binary for a free port", async () => {
    const taken = await busyPort();
    const free = taken.port;
    await taken.close();
    expect(await isPortFree(free)).toBe(true);
    const { dir, result } = await preflight(
      { "package.json": DECLARED, ...INSTALLED },
      String(free),
    );
    expect(result).toEqual({ nextBin: path.join(dir, "node_modules/next/dist/bin/next") });
  });
});

describe("startNext", () => {
  it("runs the resolved next with node and asks no package manager for it", async () => {
    const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "fp-dev-start-")));
    const shims = path.join(dir, "shims");
    const shimLog = path.join(dir, "shims.log");
    const nextBin = path.join(dir, "node_modules/next/dist/bin/next");
    const saved = { PATH: process.env.PATH, SHIM_LOG: process.env.SHIM_LOG };
    try {
      await fs.mkdir(shims, { recursive: true });
      await fs.mkdir(path.dirname(nextBin), { recursive: true });
      await fs.writeFile(
        nextBin,
        'require("node:fs").writeFileSync("argv.log", JSON.stringify(process.argv.slice(2)));\n',
      );
      for (const name of ["npx", "npm", "pnpm", "yarn", "bunx", "bun"]) {
        await fs.writeFile(path.join(shims, name), '#!/bin/sh\necho "$0 $@" >> "$SHIM_LOG"\n');
        await fs.chmod(path.join(shims, name), 0o755);
      }
      process.env.PATH = `${shims}${path.delimiter}${process.env.PATH ?? ""}`;
      process.env.SHIM_LOG = shimLog;

      const child = startNext(dir, nextBin, "3999");
      await new Promise((resolve) => child.once("exit", resolve));

      expect(JSON.parse(await fs.readFile(path.join(dir, "argv.log"), "utf8"))).toEqual([
        "dev",
        "--port",
        "3999",
      ]);
      await expect(fs.access(shimLog)).rejects.toThrow();
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
