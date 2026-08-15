import type { ColumnFormat } from "@flowpanel/core";
import { StatusBadge } from "@flowpanel/react";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderColumnFormat } from "../runtime/render-column-format.js";

describe("renderColumnFormat", () => {
  it("renders a badge, spacing snake_case and carrying the declared tone", () => {
    const format: ColumnFormat = { kind: "badge", tones: { past_due: "err" } };
    const node = renderColumnFormat(format, "past_due") as ReactElement<{
      status: string;
      tone?: string;
    }>;
    expect(isValidElement(node)).toBe(true);
    expect(node.type).toBe(StatusBadge);
    expect(node.props.status).toBe("past due");
    expect(node.props.tone).toBe("err");
  });

  it("renders money and number the way the table does", () => {
    expect(renderColumnFormat("number", 1234)).toBe("1,234");
    expect(renderColumnFormat("money", 12)).toBe("$12.00");
    expect(renderColumnFormat({ kind: "money", currency: "EUR", scale: 100 }, 4200)).toBe("€42.00");
  });

  it("shows an em-dash for an empty value under any format", () => {
    expect(renderColumnFormat("badge", null)).toBe("—");
    expect(renderColumnFormat("money", "")).toBe("—");
  });

  it("stringifies rather than falling through to money for a value it cannot format", () => {
    expect(renderColumnFormat("number", "n/a")).toBe("n/a");
    expect(renderColumnFormat("number", true)).toBe("true");
  });

  it("stringifies under an unrecognized format instead of guessing money", () => {
    const future = "duration" as unknown as ColumnFormat;
    expect(renderColumnFormat(future, 0.42)).toBe("0.42");
  });
});
