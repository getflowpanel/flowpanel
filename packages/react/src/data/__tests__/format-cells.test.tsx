// @vitest-environment happy-dom

import { resolveFormatting } from "@flowpanel/core/format";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderFormatCell } from "../render-format";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("rich column formats", () => {
  it("shades a heat percent by its value", () => {
    const { container } = render(renderFormatCell({ kind: "percent", heat: true }, 0.42));
    const cell = container.querySelector("[data-heat]");
    expect(cell?.getAttribute("data-heat")).toBe("2");
    expect(cell?.className).toContain("fp-bg-data/20");
    expect(cell?.textContent).toBe("42%");
  });

  it("links a url cell in a new tab, without opening the row", () => {
    const { container } = render(renderFormatCell("url", "https://kwork.ru/projects/1"));
    const link = container.querySelector("a");
    expect(link?.textContent).toBe("kwork.ru/projects/1");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    const onRow = vi.fn();
    document.body.addEventListener("click", onRow);
    link?.addEventListener("click", (event) => event.preventDefault());
    link?.click();
    document.body.removeEventListener("click", onRow);
    expect(onRow).not.toHaveBeenCalled();
  });

  it("keeps Enter on a link from reaching the row", () => {
    const onRow = vi.fn();
    const { container } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: stands in for a table row's key handler
      <div onKeyDown={onRow}>{renderFormatCell("url", "https://kwork.ru")}</div>,
    );
    const link = container.querySelector("a");
    if (!link) throw new Error("the url cell rendered no link");
    fireEvent.keyDown(link, { key: "Enter" });
    expect(onRow).not.toHaveBeenCalled();
  });

  it("reads a boolean glyph out as yes or no", () => {
    const { container } = render(renderFormatCell("boolean", false));
    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("✕");
    expect(container.querySelector(".fp-sr-only")?.textContent).toBe("No");
  });

  it("keeps a same-site url in the tab and a script url as text", () => {
    const { container } = render(
      <>
        {renderFormatCell("url", "/admin/order/7")}
        {renderFormatCell("url", "javascript:alert(1)")}
      </>,
    );
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("a")?.hasAttribute("target")).toBe(false);
    expect(container.textContent).toContain("javascript:alert(1)");
  });

  it("says how long ago, with the exact time in the tooltip", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
    render(
      renderFormatCell("relative", "2026-09-23T11:55:00Z", resolveFormatting({ timeZone: "UTC" })),
    );
    const time = screen.getByText("5 minutes ago");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("datetime")).toBe("2026-09-23T11:55:00.000Z");
    expect(time.getAttribute("title")).toBe("Sep 23, 2026, 11:55:00 AM UTC");
  });

  it("reads a zoneless timestamp as UTC, as a date cell does", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
    render(renderFormatCell("relative", "2026-09-23 11:55:00"));
    expect(screen.getByText("5 minutes ago").getAttribute("datetime")).toBe(
      "2026-09-23T11:55:00.000Z",
    );
  });

  it("keeps a relative value that is not an ISO date as text", () => {
    const { container } = render(renderFormatCell("relative", "Sep 23 2026"));
    expect(container.querySelector("time")).toBeNull();
    expect(container.textContent).toBe("Sep 23 2026");
  });

  it("reads SQLite's 1 and 0 out as yes or no", () => {
    const { container } = render(
      <>
        {renderFormatCell("boolean", 1)}
        {renderFormatCell("boolean", 0)}
      </>,
    );
    const texts = (selector: string) =>
      [...container.querySelectorAll(selector)].map((node) => node.textContent);
    expect(texts("[aria-hidden]")).toEqual(["✓", "✕"]);
    expect(texts(".fp-sr-only")).toEqual(["Yes", "No"]);
  });
});
