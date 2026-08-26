import type { ColumnFormat } from "@flowpanel/core";
import { renderFormatCell, StatusBadge } from "@flowpanel/react";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderColumnFormat } from "../runtime/render-column-format";

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

describe("renderColumnFormat / renderFormatCell parity", () => {
  const cases: Array<[string, ColumnFormat, unknown]> = [
    ["number", "number", 1234],
    ["numeric string", "number", "1234"],
    ["money default currency", "money", 12],
    ["money object, no currency", { kind: "money" }, 12],
    ["money scaled", { kind: "money", currency: "EUR", scale: 100 }, 4200],
    ["money scale 0", { kind: "money", scale: 0 }, 5],
    ["empty", "money", ""],
    ["null", "number", null],
    ["unformattable", "number", "n/a"],
  ];

  it.each(cases)("server and client format %s identically", (_name, format, value) => {
    expect(renderColumnFormat(format, value)).toBe(renderFormatCell(format, value));
  });

  const badgeCases: Array<[string, ColumnFormat, unknown]> = [
    ["bare badge", "badge", "past_due"],
    ["badge with a matching tone", { kind: "badge", tones: { past_due: "err" } }, "past_due"],
    ["badge with no tone for the value", { kind: "badge", tones: { paid: "ok" } }, "past_due"],
    ["badge without a tones map", { kind: "badge" }, "past_due"],
    ["badge, empty value", "badge", null],
  ];

  // The two copies used to guard the tone lookup differently — `typeof format
  // === "object"` on the client vs. an extra `format.kind === "badge"` on the
  // server. Both are reachable only through the enclosing badge guard, so the
  // extra check was dead; this pins that they agree.
  it.each(
    badgeCases,
  )("server and client resolve the %s tone identically", (_name, format, value) => {
    type BadgeProps = { status: string; tone?: string };
    const server = renderColumnFormat(format, value);
    const client = renderFormatCell(format, value);
    if (!isValidElement(server)) {
      expect(server).toBe(client);
      return;
    }
    const a = (server as ReactElement<BadgeProps>).props;
    const b = (client as ReactElement<BadgeProps>).props;
    expect(a.status).toBe(b.status);
    expect(a.tone).toBe(b.tone);
  });
});
