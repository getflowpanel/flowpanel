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

  it("describes the CLI and each command the way the docs quote them", () => {
    const program = createProgram();
    const help = (name: string) =>
      program.commands.find((c) => c.name() === name)?.helpInformation();

    expect(program.description()).toBe("Add a typed admin panel to a Next.js app");
    expect(program.commands.find((c) => c.name() === "dev")?.description()).toBe(
      "Run next dev, plus the queue board when REDIS_URL is set",
    );
    expect(help("dev")).toContain("Skip the queue board (bull-board) even if REDIS_URL is set");
    expect(help("init")).toContain("--path <path>");
    expect(help("doctor")).toContain("--path <path>");
    expect(help("init")).not.toContain("--path <url>");
    expect(help("doctor")).not.toContain("--path <url>");
  });

  it("states the default adapter kind once", () => {
    const help =
      createProgram()
        .commands.find((c) => c.name() === "new")
        ?.helpInformation() ?? "";
    const kind = help.slice(help.indexOf("--kind"), help.indexOf("--dir")).replace(/\s+/g, " ");
    expect(kind).toBe(
      "--kind <kind> Adapter kind: drizzle or prisma (default: the config's adapter) ",
    );
    expect(help).not.toContain('"drizzle"');
  });
});
