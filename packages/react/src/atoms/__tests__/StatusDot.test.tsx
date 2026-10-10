// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Tone } from "../../lib/format";
import { toneFillClass } from "../../lib/tone-classes";
import { StatusDot } from "../StatusDot";

const TONES: Tone[] = ["default", "accent", "ok", "warn", "err", "info", "muted"];

afterEach(cleanup);

describe("StatusDot", () => {
  it("fills with the kit's class for every tone", () => {
    for (const tone of TONES) {
      const { container, unmount } = render(<StatusDot tone={tone} />);
      expect(container.querySelector("span")?.className).toContain(toneFillClass[tone]);
      unmount();
    }
  });

  it("fills default with the data colour, as a default bar does, and muted with grey", () => {
    const data = render(<StatusDot tone="default" />).container.querySelector("span");
    expect(data?.className).toContain("fp-bg-data");
    cleanup();
    const grey = render(<StatusDot tone="muted" />).container.querySelector("span");
    expect(grey?.className).toContain("fp-bg-faint");
  });

  it("is ok when no tone is given, and hidden from screen readers", () => {
    const { container } = render(<StatusDot />);
    const dot = container.querySelector("span");
    expect(dot?.className).toContain("fp-bg-ok");
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });
});
