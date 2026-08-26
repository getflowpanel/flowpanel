import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { findBoardScript, pipeWithPrefix } from "../dev";

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
