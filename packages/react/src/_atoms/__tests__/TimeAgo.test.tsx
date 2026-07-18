// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeAgo } from "../TimeAgo.js";

afterEach(cleanup);

describe("TimeAgo", () => {
  it("renders a relative label for a past date", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    render(<TimeAgo date={twoHoursAgo} />);
    const t = screen.getByText(/hour/i);
    expect(t).toBeTruthy();
    expect((t as HTMLTimeElement).dateTime).toBe(twoHoursAgo.toISOString());
  });

  it("accepts ISO string input", () => {
    const past = new Date(Date.now() - 5 * 60_000).toISOString();
    render(<TimeAgo date={past} />);
    expect(screen.getByText(/minute|min/i)).toBeTruthy();
  });

  it("hydrates without a mismatch warning even when server and client clocks disagree", async () => {
    vi.useFakeTimers();
    try {
      const serverNow = new Date("2026-01-01T00:00:00.000Z");
      vi.setSystemTime(serverNow);
      const target = new Date(serverNow.getTime() - 24_000);
      const serverHtml = renderToString(<TimeAgo date={target} />);
      expect(serverHtml).toContain("24 seconds ago");

      // Client hydrates a few seconds later — same bug the demo reproduced
      // ("24 seconds ago" on the server, "1 second ago" on first client paint).
      vi.setSystemTime(new Date(serverNow.getTime() + 23_000));

      const container = document.createElement("div");
      container.innerHTML = serverHtml;
      document.body.appendChild(container);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await act(async () => {
        hydrateRoot(container, <TimeAgo date={target} />);
      });

      const hydrationMismatch = errorSpy.mock.calls.some((args) =>
        args.some((a) => a instanceof Error && a.message.includes("Hydration failed")),
      );
      expect(hydrationMismatch).toBe(false);

      errorSpy.mockRestore();
      document.body.removeChild(container);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the dateTime attribute stable across server and client renders", () => {
    const target = new Date("2026-03-01T10:00:00.000Z");
    const serverHtml = renderToString(<TimeAgo date={target} />);
    expect(serverHtml).toContain(`dateTime="${target.toISOString()}"`);

    const { container } = render(<TimeAgo date={target} />);
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(target.toISOString());
  });
});
