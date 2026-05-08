import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LiveIndicator } from "../LiveIndicator.js";

afterEach(cleanup);

describe("LiveIndicator", () => {
  it("renders status label for each LiveStatus", () => {
    render(<LiveIndicator status="live" />);
    expect(screen.getByText("Live")).toBeTruthy();
    cleanup();
    render(<LiveIndicator status="reconnecting" />);
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
    cleanup();
    render(<LiveIndicator status="offline" />);
    expect(screen.getByText("Offline")).toBeTruthy();
  });

  it("uses role='status' and aria-live='polite'", () => {
    render(<LiveIndicator status="live" />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });
});
