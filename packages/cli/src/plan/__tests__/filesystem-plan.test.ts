import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertPlanHasNoConflicts, createFilesystemPlan, publicPlan } from "../filesystem-plan.js";
import { applyFilesystemPlan } from "../transaction.js";

let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "flowpanel plan with spaces "));
});

afterEach(async () => {
  await fs.rm(cwd, { recursive: true, force: true });
});

describe("filesystem plan", () => {
  it("classifies create, skip, safe modify and conflict without changing disk", async () => {
    await fs.writeFile(path.join(cwd, "same.ts"), "same");
    await fs.writeFile(path.join(cwd, "known.ts"), "old");
    await fs.writeFile(path.join(cwd, "mine.ts"), "custom");

    const plan = await createFilesystemPlan(cwd, [
      { path: "new.ts", content: "new" },
      { path: "same.ts", content: "same" },
      { path: "known.ts", content: "new", expectedContent: "old" },
      { path: "mine.ts", content: "generated" },
    ]);

    expect(plan.operations.map(({ kind }) => kind)).toEqual([
      "create",
      "skip",
      "modify",
      "conflict",
    ]);
    expect(await fs.readFile(path.join(cwd, "known.ts"), "utf8")).toBe("old");
    expect(publicPlan(plan).summary).toEqual({ create: 1, modify: 1, skip: 1, conflict: 1 });
    expect(() => assertPlanHasNoConflicts(plan)).toThrow(/mine\.ts/);
  });

  it.each(["../escape.ts", "/absolute.ts", ""])("rejects unsafe path %j", async (file) => {
    await expect(createFilesystemPlan(cwd, [{ path: file, content: "x" }])).rejects.toThrow(
      /Unsafe project path/,
    );
  });

  it("rolls earlier writes back when a later write fails", async () => {
    await fs.writeFile(path.join(cwd, "existing.ts"), "before");
    const plan = await createFilesystemPlan(cwd, [
      { path: "created.ts", content: "created" },
      { path: "existing.ts", content: "after", overwrite: true },
    ]);

    await expect(
      applyFilesystemPlan(plan, {
        beforeWrite(_operation, index) {
          if (index === 1) throw new Error("simulated disk failure");
        },
      }),
    ).rejects.toThrow(/simulated disk failure/);

    await expect(fs.access(path.join(cwd, "created.ts"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readFile(path.join(cwd, "existing.ts"), "utf8")).toBe("before");
  });

  it("applies a conflict-free plan and is idempotent on rerun", async () => {
    const first = await createFilesystemPlan(cwd, [{ path: "nested/file.ts", content: "value" }]);
    expect(await applyFilesystemPlan(first)).toEqual([path.join("nested", "file.ts")]);

    const second = await createFilesystemPlan(cwd, [{ path: "nested/file.ts", content: "value" }]);
    expect(second.operations[0]?.kind).toBe("skip");
    expect(await applyFilesystemPlan(second)).toEqual([]);
  });
});
