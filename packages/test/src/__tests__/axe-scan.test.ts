import { describe, expect, it, vi } from "vitest";

const excluded: string[] = [];

vi.mock("@axe-core/playwright", () => ({
  default: class {
    withTags() {
      return this;
    }
    exclude(selector: string) {
      excluded.push(selector);
      return this;
    }
    async analyze() {
      return {
        violations: [
          {
            id: "button-name",
            impact: "critical",
            nodes: [{ target: ["main", "button.menu"] }, { target: ["#save"] }],
          },
        ],
      };
    }
  },
}));

import { createAxeScanner } from "../axe";

describe("the axe scan", () => {
  it("leaves out iframes and names each failing element", async () => {
    const scan = await createAxeScanner({} as Parameters<typeof createAxeScanner>[0]);

    expect(await scan()).toEqual([
      { id: "button-name", impact: "critical", targets: ["main button.menu", "#save"] },
    ]);
    expect(excluded).toEqual(["iframe"]);
  });
});
