import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RUNTIME_DOC_CLAIMS } from "../docs/runtime-claims";

describe("high-risk documentation claims", () => {
  it("are uniquely backed by named tests", () => {
    const root = join(import.meta.dirname, "../..");
    expect(new Set(RUNTIME_DOC_CLAIMS.map((claim) => claim.id)).size).toBe(
      RUNTIME_DOC_CLAIMS.length,
    );

    for (const claim of RUNTIME_DOC_CLAIMS) {
      const file = join(root, claim.testFile);
      expect(existsSync(file), `${claim.id}: ${claim.testFile}`).toBe(true);
      expect(readFileSync(file, "utf8"), claim.id).toContain(claim.testName);
      expect(claim.pages.length, claim.id).toBeGreaterThan(0);
    }
  });
});
