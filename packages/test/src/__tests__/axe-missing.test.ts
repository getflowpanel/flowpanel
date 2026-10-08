import { describe, expect, it, vi } from "vitest";

vi.mock("@axe-core/playwright", () => {
  throw new Error("Cannot find package '@axe-core/playwright'");
});

import { smokeAdmin } from "../smoke-admin";

describe("smokeAdmin with a11y and no @axe-core/playwright", () => {
  it("fails and names the package instead of passing without a scan", async () => {
    const page = {} as Parameters<typeof smokeAdmin>[0];
    await expect(smokeAdmin(page, { a11y: true })).rejects.toThrow(
      /a11y: true needs @axe-core\/playwright\. Install it as a dev dependency/,
    );
  });
});
