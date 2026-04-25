import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FlowPanelConfigError } from "../../errors";
import { renderConfigError } from "../render";

describe("renderConfigError", () => {
  it("renders just the message when context is empty", () => {
    expect(renderConfigError("bad config", {})).toBe("FlowPanel config error: bad config");
  });

  it("includes hint + didYouMean + docs when provided", () => {
    const out = renderConfigError('unknown field "plna"', {
      hint: "Check the resource fields block",
      didYouMean: ["plan"],
      docs: "https://flowpanel.dev/errors/unknown-field",
    });
    expect(out).toContain('"plna"');
    expect(out).toContain("Hint: Check the resource fields block");
    expect(out).toContain('Did you mean: "plan"?');
    expect(out).toContain("Docs: https://flowpanel.dev/errors/unknown-field");
  });

  it("includes a code frame when source points at a real file", () => {
    const dir = mkdtempSync(join(tmpdir(), "fp-render-"));
    const file = join(dir, "conf.ts");
    writeFileSync(file, ["alpha", "beta", "gamma"].join("\n"));
    try {
      const out = renderConfigError("boom", { source: { file, line: 2 } });
      expect(out).toContain(`at ${file}:2`);
      expect(out).toContain("> 2 │ beta");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders Received block for non-trivial values", () => {
    const out = renderConfigError("bad shape", { received: { foo: 1 } });
    expect(out).toContain('Received: {"foo":1}');
  });
});

describe("FlowPanelConfigError context", () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fp-ctx-"));
    file = join(dir, "c.ts");
    writeFileSync(file, "config\n");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("stores context and rawMessage", () => {
    const err = new FlowPanelConfigError("kaboom", {
      source: { file, line: 1 },
      hint: "see docs",
      didYouMean: ["kablam"],
      docs: "https://x",
    });
    expect(err.rawMessage).toBe("kaboom");
    expect(err.context.hint).toBe("see docs");
    expect(err.context.didYouMean).toEqual(["kablam"]);
    expect(err.message).toContain("kaboom");
    expect(err.message).toContain("see docs");
    expect(err.message).toContain('"kablam"');
    expect(err.message).toContain("https://x");
  });
});
