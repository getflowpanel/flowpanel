import pc from "picocolors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUi, failCommand } from "../ui";

afterEach(() => {
  vi.restoreAllMocks();
  delete (process.stdout as { isTTY?: boolean }).isTTY;
});

describe("createUi in a pipe", () => {
  it("writes plain lines even when picocolors adds colour codes", () => {
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    const colors = pc.createColors(true);
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    const ui = createUi(false);
    ui.outro(colors.green("2 migrations applied"));
    ui.note(colors.dim("0001_init.sql"), "Would apply");
    expect(written.join("")).toBe("2 migrations applied\n\nWould apply\n  0001_init.sql\n");
  });

  it("keeps a blank line on both sides of a block", () => {
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    const ui = createUi(false);
    ui.ok("config found");
    ui.note("0001_init.sql", "Would apply");
    ui.note("0002_more.sql", "Then");
    ui.info("nothing else");
    expect(written.join("")).toBe(
      "✓ config found\n\nWould apply\n  0001_init.sql\n\nThen\n  0002_more.sql\n\n· nothing else\n",
    );
  });

  it("stops with a marked line on stderr and exit code 1", () => {
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    const errors: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      errors.push(String(chunk));
      return true;
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((): never => {
      throw new Error("exit");
    });
    expect(() => failCommand("new", false, "Nothing was written.")).toThrow("exit");
    expect(errors.join("")).toBe("✗ Nothing was written.\n");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("puts the error in the command's JSON envelope", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    vi.spyOn(process, "exit").mockImplementation((): never => {
      throw new Error("exit");
    });
    expect(() => failCommand("doctor", true, "No Next.js project", { ok: false })).toThrow("exit");
    expect(JSON.parse(written.join(""))).toEqual({
      command: "doctor",
      ok: false,
      error: "No Next.js project",
    });
  });
});
