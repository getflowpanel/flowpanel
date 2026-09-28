// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/admin/parsing",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { DashboardDateRange } from "../pages/dashboard-date-range";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardDateRange", () => {
  it("drops a ?preset= the dashboard did not apply", () => {
    nav.search = "preset=YTD&tab=x";
    render(<DashboardDateRange preset="last7d" presets={["today", "last7d"]} />);
    expect(nav.router.replace).toHaveBeenCalledWith("/admin/parsing?tab=x", { scroll: false });
  });

  it("shows a custom range as its days, and a picked preset replaces it", () => {
    nav.search = "from=2026-09-01T00:00:00.000Z&to=2026-09-07T00:00:00.000Z";
    render(<DashboardDateRange from="2026-09-01T00:00:00.000Z" to="2026-09-07T00:00:00.000Z" />);
    const trigger = screen.getByRole("button");
    expect(trigger.textContent).toBe("2026-09-01 – 2026-09-07");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByText("Today"));
    expect(nav.router.push).toHaveBeenCalledWith("/admin/parsing?preset=today", { scroll: false });
    expect(nav.router.replace).not.toHaveBeenCalled();
  });
});
