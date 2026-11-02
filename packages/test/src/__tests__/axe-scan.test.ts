import { beforeEach, describe, expect, it, vi } from "vitest";

const excluded: string[] = [];
const disabled: string[][] = [];

vi.mock("@axe-core/playwright", () => ({
  default: class {
    withTags() {
      return this;
    }
    exclude(selector: string) {
      excluded.push(selector);
      return this;
    }
    disableRules(rules: string[]) {
      disabled.push(rules);
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

type ScanPage = Parameters<typeof createAxeScanner>[0];

beforeEach(() => {
  excluded.length = 0;
  disabled.length = 0;
});

describe("the axe scan", () => {
  it("leaves out iframes and names each failing element", async () => {
    const scan = await createAxeScanner({} as ScanPage);

    expect(await scan()).toEqual([
      { id: "button-name", impact: "critical", targets: ["main button.menu", "#save"] },
    ]);
    expect(excluded).toEqual(["iframe"]);
    expect(disabled).toEqual([]);
  });

  it("skips the rules a project disables", async () => {
    const scan = await createAxeScanner({} as ScanPage, {
      disableRules: ["color-contrast", "region"],
    });
    await scan();
    expect(disabled).toEqual([["color-contrast", "region"]]);
  });
});
