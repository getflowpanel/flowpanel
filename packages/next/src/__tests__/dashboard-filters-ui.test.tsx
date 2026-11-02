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

import { DashboardFilters, filterQuery } from "../pages/dashboard-filters";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const filters = [
  {
    key: "platform",
    label: "Marketplace",
    value: "kwork",
    options: [
      { label: "Kwork", value: "kwork" },
      { label: "FL.ru", value: "fl" },
    ],
  },
];

describe("DashboardFilters", () => {
  it("sets and clears a filter in the query, keeping the range", () => {
    expect(filterQuery("preset=today", { platform: "fl" })).toBe("preset=today&f_platform=fl");
    expect(filterQuery("preset=today&f_platform=fl", { platform: null })).toBe("preset=today");
    expect(filterQuery("preset=today&activity.before=x~1", { platform: "fl" })).toBe(
      "preset=today&f_platform=fl",
    );
  });

  it("offers a clear button once a filter is set, and it drops every filter", () => {
    nav.search = "preset=today&f_platform=kwork";
    render(<DashboardFilters filters={filters} />);
    expect(screen.getByRole("button", { name: "Clear filters" }).className).toContain(
      "fp-min-h-11",
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.router.push).toHaveBeenCalledWith("/admin/parsing?preset=today", { scroll: false });
  });

  it("renders nothing without filters", () => {
    const { container } = render(<DashboardFilters filters={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
