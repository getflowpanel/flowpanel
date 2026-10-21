// @vitest-environment happy-dom

import { formatColumnValue } from "@flowpanel/core/format";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderDefaultCell } from "../render-default-cell";
import { renderFormatCell } from "../render-format";

afterEach(cleanup);

describe("badge format labels", () => {
  const format = {
    kind: "badge" as const,
    tones: { admin: "warn" as const },
    labels: { admin: "Админ", freelancer: "Фрилансер" },
  };

  it("shows the label and keeps the tone keyed by the raw value", () => {
    const { container } = render(renderFormatCell(format, "admin"));
    expect(screen.getByText("Админ")).toBeTruthy();
    expect(container.querySelector("span")?.className).toMatch(/fp-text-warn-ink/);
    expect(container.querySelector("span")?.className).not.toContain("capitalize");
  });

  it("falls back to the spaced raw value for a value with no label", () => {
    render(renderFormatCell(format, "past_due"));
    expect(screen.getByText("past due")).toBeTruthy();
  });

  it("labels a badge-formatted string outside a table", () => {
    expect(formatColumnValue("freelancer", format)).toBe("Фрилансер");
    expect(formatColumnValue("guest", format)).toBe("guest");
  });
});

describe("an enum column's labels", () => {
  it("shows the label its form's select shows, and the raw value it has none for", () => {
    const column = {
      field: "status" as const,
      options: [{ value: "paid", label: "Paid" }],
    };
    render(renderDefaultCell(column, { status: "paid" }));
    expect(screen.getByText("Paid")).toBeTruthy();
    cleanup();
    render(renderDefaultCell(column, { status: "refunded" }));
    expect(screen.getByText("refunded")).toBeTruthy();
  });
});
