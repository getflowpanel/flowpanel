import { describe, expect, it } from "vitest";
import { sanitizeStack } from "../errorSanitizer";

describe("sanitizeStack", () => {
  it("strips absolute paths to relative", () => {
    const cwd = "/Users/alice/project";
    const stack = `Error: oops\n    at fn (/Users/alice/project/src/worker.ts:42:5)`;
    const result = sanitizeStack(stack, cwd);
    expect(result).not.toContain("/Users/alice/project");
    expect(result).toContain("src/worker.ts:42:5");
  });

  it("caps stack at 20 frames", () => {
    const frames = Array.from({ length: 25 }, (_, i) => `    at fn${i} (src/file.ts:${i}:1)`);
    const stack = `Error: too many\n${frames.join("\n")}`;
    const result = sanitizeStack(stack, process.cwd());
    const frameCount = (result.match(/ {4}at /g) ?? []).length;
    expect(frameCount).toBeLessThanOrEqual(20);
    expect(result).toContain("frames omitted");
  });

  it("removes node:internal frames", () => {
    const stack = `Error: x\n    at fn (src/a.ts:1:1)\n    at process (node:internal/process/task_queues:141:7)`;
    const result = sanitizeStack(stack, process.cwd());
    expect(result).not.toContain("node:internal");
  });

  it("collapses node_modules frames to package name", () => {
    const stack = `Error: x\n    at Object.<anonymous> (node_modules/openai/dist/index.js:100:5)`;
    const result = sanitizeStack(stack, process.cwd());
    expect(result).toContain("(openai)");
    expect(result).not.toContain("node_modules/openai/dist");
  });

  it("keeps @flowpanel frames", () => {
    const stack = `Error: x\n    at withRun (node_modules/@flowpanel/core/dist/withRun.js:42:5)`;
    const result = sanitizeStack(stack, process.cwd());
    expect(result).toContain("@flowpanel/core");
  });
});
