import { describe, expect, it } from "vitest";
import { rowEndRem } from "../DataTableWithDrawerRows";

const action = (label: string, extra: Record<string, unknown> = {}) => ({
  key: label,
  label,
  hasForm: false,
  placement: "inline" as const,
  ...extra,
});

describe("the actions column beside inline row actions", () => {
  it("is wide enough for each inline button and the menu beside them", () => {
    const one = rowEndRem([[action("Mark paid")]]);
    const withMenu = rowEndRem([
      [action("Mark paid"), { key: "x", label: "Void", hasForm: false }],
    ]);
    expect(withMenu - one).toBeCloseTo(2, 6);
    expect(rowEndRem([[action("Mark paid", { icon: "check" })]]) - one).toBeCloseTo(1.5, 6);
  });

  it("counts wide script by its width, not its length", () => {
    expect(rowEndRem([[action("支払い済みにする")]])).toBeGreaterThan(
      rowEndRem([[action("Mark it paid")]]),
    );
  });

  it("is zero when no action sits inline", () => {
    expect(rowEndRem([[{ key: "x", label: "Void", hasForm: false }], undefined])).toBe(0);
  });
});
