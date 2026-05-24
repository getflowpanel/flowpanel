// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { LocalTime } from "../LocalTime.js";

afterEach(() => cleanup());

describe("LocalTime", () => {
  it("renders the placeholder for a null date", () => {
    const { container } = render(<LocalTime date={null} />);
    expect(container.textContent).toBe("—");
    expect(container.querySelector("time")).toBeNull();
  });

  it("renders a custom placeholder for an invalid date string", () => {
    const { container } = render(<LocalTime date="not-a-date" placeholder="n/a" />);
    expect(container.textContent).toBe("n/a");
  });

  it("wraps a valid date in <time> carrying the ISO dateTime attribute", () => {
    const iso = "2026-05-29T12:34:56.000Z";
    const { container } = render(<LocalTime date={iso} />);
    const el = container.querySelector("time");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("dateTime")).toBe(new Date(iso).toISOString());
  });

  it("formats visible text in the viewer's local zone (no pinned timeZone) after mount", () => {
    const iso = "2026-05-29T12:34:56.000Z";
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };
    const { container } = render(<LocalTime date={iso} locale="ru-RU" options={options} />);
    // After effects flush the component must use the runtime's local zone —
    // i.e. exactly `Intl` with NO `timeZone` pinned. This is what makes the
    // displayed clock match the device instead of the server.
    const expected = new Intl.DateTimeFormat("ru-RU", options).format(new Date(iso));
    expect(container.querySelector("time")?.textContent).toBe(expected);
  });

  it("server-renders a deterministic en-CA value that ignores the runtime default locale", () => {
    // The whole point of the fallback: the SSR markup must NOT depend on the
    // runtime's default locale. With the locale pinned to en-CA and the zone
    // pinned to fallbackTimeZone=UTC, the text is fully deterministic.
    const html = renderToStaticMarkup(
      <LocalTime date="2026-05-29T12:34:56.000Z" fallbackTimeZone="UTC" />,
    );
    // 12:34 UTC → en-CA + DEFAULT_OPTIONS = "2026-05-29, 12:34", comma stripped.
    expect(html).toContain("2026-05-29 12:34");
    // And it definitely must not carry the group separator.
    expect(html).not.toContain("2026-05-29, 12:34");
  });

  it("strips the comma in the all-defaults path (sortable format preserved)", () => {
    // Pick a zone-independent assertion: pin UTC via fallbackTimeZone and read
    // the pre-mount (server) markup so the result doesn't depend on the host TZ.
    const html = renderToStaticMarkup(
      <LocalTime date="2026-05-29T14:30:00.000Z" fallbackTimeZone="UTC" />,
    );
    expect(html).toContain("2026-05-29 14:30");
    expect(html).not.toContain("2026-05-29, 14:30");
  });

  it("honors an explicit options object verbatim (comma NOT stripped)", () => {
    const iso = "2026-05-29T14:30:00.000Z";
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    };
    // Explicit options/locale → output must match raw Intl, separator intact.
    const html = renderToStaticMarkup(<LocalTime date={iso} locale="en-CA" options={options} />);
    const expected = new Intl.DateTimeFormat("en-CA", options).format(new Date(iso));
    expect(expected).toContain(", ");
    expect(html).toContain(expected);
  });

  it("accepts a Date instance directly", () => {
    const d = new Date("2026-01-15T08:00:00.000Z");
    const { container } = render(<LocalTime date={d} />);
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(d.toISOString());
  });
});
