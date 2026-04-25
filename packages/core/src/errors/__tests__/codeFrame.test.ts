import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCodeFrame } from "../codeFrame";

describe("renderCodeFrame", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flowpanel-codeframe-"));
    file = join(dir, "sample.ts");
    writeFileSync(file, ["line 1", "line 2", "line 3 <- target", "line 4", "line 5"].join("\n"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("renders ±2 lines around the target with a > marker", () => {
    const frame = renderCodeFrame(file, { line: 3 });
    expect(frame).toMatchInlineSnapshot(`
"  1 │ line 1
  2 │ line 2
> 3 │ line 3 <- target
  4 │ line 4
  5 │ line 5"
`);
  });

  it("adds a caret when column is given", () => {
    const frame = renderCodeFrame(file, { line: 3, column: 8 });
    expect(frame).toContain("^");
    const lines = frame?.split("\n") ?? [];
    const caretLine = lines[lines.findIndex((l) => l.startsWith(">")) + 1];
    expect(caretLine?.trim()).toBe("^");
  });

  it("clamps context at file boundaries", () => {
    const frame = renderCodeFrame(file, { line: 1 });
    expect(frame?.split("\n")[0]).toBe("> 1 │ line 1");
  });

  it("returns null for a missing file", () => {
    expect(renderCodeFrame(join(dir, "nope.ts"), { line: 1 })).toBeNull();
  });
});
