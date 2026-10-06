import type { ColumnFormat } from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import {
  BooleanCell,
  HeatCell,
  RelativeTimeCell,
  renderFormatCell,
  StatusBadge,
  ToneText,
  UrlCell,
} from "@flowpanel/react";
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

  it("shows a badge's label while tones stay keyed by the raw value", () => {
    const format: ColumnFormat = {
      kind: "badge",
      tones: { freelancer: "info" },
      labels: { freelancer: "Фрилансер" },
    };
    const node = renderColumnFormat(format, "freelancer") as ReactElement<{
      status: string;
      label?: string;
      tone?: string;
      className?: string;
    }>;
    expect(node.props.status).toBe("freelancer");
    expect(node.props.label).toBe("Фрилансер");
    expect(node.props.tone).toBe("info");
    expect(node.props.className).toBeUndefined();
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
    const future = "sparkline" as unknown as ColumnFormat;
    expect(renderColumnFormat(future, 0.42)).toBe("0.42");
  });

  it("follows the configured locale and currency", () => {
    const ru = resolveFormatting({ locale: "ru-RU", currency: "RUB" });
    expect(renderColumnFormat("number", 1774, ru)).toMatch(/1\s?774/);
    expect(renderColumnFormat("money", 12, ru)).toContain("\u20BD");
    expect(renderColumnFormat({ kind: "money", currency: "EUR" }, 12, ru)).toContain("\u20AC");
  });

  it("colours a numeric cell by its threshold", () => {
    const node = renderColumnFormat(
      { kind: "percent", tones: { warn: 0.3, err: 0.5 } },
      0.6,
    ) as ReactElement<{ tone: string; text: string }>;
    expect(node.type).toBe(ToneText);
    expect(node.props).toMatchObject({ tone: "err", text: "60%" });
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
    ["badge with a label", { kind: "badge", labels: { admin: "Админ" } }, "admin"],
  ];

  // The two copies used to guard the tone lookup differently — `typeof format
  // === "object"` on the client vs. an extra `format.kind === "badge"` on the
  // server. Both are reachable only through the enclosing badge guard, so the
  // extra check was dead; this pins that they agree.
  it.each(badgeCases)(
    "server and client resolve the %s tone identically",
    (_name, format, value) => {
      type BadgeProps = { status: string; tone?: string; label?: string };
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
      expect(a.label).toBe(b.label);
    },
  );
});

describe("renderColumnFormat / renderFormatCell parity — date, percent, duration, boolean, url, relative", () => {
  const textCases: Array<[string, ColumnFormat, unknown]> = [
    ["date", "date", new Date("2026-09-23T21:30:00Z")],
    ["date with time", { kind: "date", time: true }, "2026-09-23T21:30:00Z"],
    ["percent", "percent", 0.423],
    ["duration", "duration", 4200],
    ["boolean with words", { kind: "boolean", labels: { true: "да" } }, true],
    ["url that cannot be a link", "url", "javascript:alert(1)"],
  ];

  it.each(textCases)("server and client render %s as the same text", (_name, format, value) => {
    const server = renderColumnFormat(format, value);
    expect(typeof server).toBe("string");
    expect(server).toBe(renderFormatCell(format, value));
  });

  const elementCases: Array<[string, ColumnFormat, unknown, unknown]> = [
    ["heat percent", { kind: "percent", heat: true }, 0.42, HeatCell],
    ["url", "url", "https://kwork.ru/projects/1", UrlCell],
    ["relative time", "relative", "2026-09-23T11:55:00Z", RelativeTimeCell],
    ["boolean", "boolean", true, BooleanCell],
  ];

  it.each(elementCases)(
    "server and client render a %s as the same element",
    (_name, format, value, type) => {
      const server = renderColumnFormat(format, value) as ReactElement<Record<string, unknown>>;
      const client = renderFormatCell(format, value) as ReactElement<Record<string, unknown>>;
      expect(isValidElement(server)).toBe(true);
      expect(server.type).toBe(type);
      expect(client.type).toBe(type);
      expect(server.props).toEqual(client.props);
    },
  );
});
