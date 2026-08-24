import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("release consistency", () => {
  it("keeps public docs, assets and compatibility claims aligned", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-release-consistency.mjs"], {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
