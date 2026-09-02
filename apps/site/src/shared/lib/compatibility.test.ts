import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPATIBILITY_OVERRIDES, readCompatibility } from "./compatibility";

describe("readCompatibility", () => {
  it("reads supported versions from package metadata", () => {
    const root = join(import.meta.dirname, "../../../../..");
    const items = readCompatibility(root);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "node",
          range: ">=20",
          source: "packages/cli/package.json#engines.node",
        }),
        expect.objectContaining({ id: "next", range: "^16.3.0" }),
        expect.objectContaining({ id: "react", range: "^19.0.0" }),
        expect.objectContaining({ id: "drizzle", range: ">=0.45.2 <1.0.0" }),
        expect.objectContaining({ id: "prisma", range: ">=5.0.0 <7.0.0" }),
      ]),
    );
  });

  it("explains the checked Next.js CLI override", () => {
    expect(COMPATIBILITY_OVERRIDES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "next",
          range: "^16.3.0",
          reason: expect.stringMatching(/CLI.*doctor/i),
        }),
      ]),
    );
  });
});
