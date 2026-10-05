import pc from "picocolors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUi } from "../ui";

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
    expect(written.join("")).toBe("2 migrations applied\nWould apply\n  0001_init.sql\n");
  });
});
