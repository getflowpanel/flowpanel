import { spawn } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../program";

vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:child_process")>();
  return { ...original, spawn: vi.fn(original.spawn) };
});

describe("createProgram", () => {
  afterEach(() => vi.restoreAllMocks());

  it("constructs commands in the public help order without running actions", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "migrate",
      "doctor",
      "eject",
      "dev",
      "new",
    ]);
    expect(spawn).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
