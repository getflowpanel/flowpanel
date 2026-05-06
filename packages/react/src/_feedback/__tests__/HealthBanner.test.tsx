// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HealthBanner } from "../HealthBanner.js";

afterEach(cleanup);

describe("HealthBanner", () => {
  it("renders info tone with role=status and visible title/description", () => {
    render(<HealthBanner tone="info" title="All good" description="Everything is fine." />);
    const status = screen.getByRole("status");
    expect(status).toBeTruthy();
    expect(screen.getByText("All good")).toBeTruthy();
    expect(screen.getByText("Everything is fine.")).toBeTruthy();
  });

  it("renders warn tone with role=status", () => {
    render(<HealthBanner tone="warn" title="Careful" />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Careful")).toBeTruthy();
  });

  it("renders error tone with role=alert and optional action slot", () => {
    render(
      <HealthBanner tone="error" title="Down" action={<button type="button">Retry</button>} />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
