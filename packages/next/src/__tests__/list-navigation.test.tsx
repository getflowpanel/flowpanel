// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/admin/matches",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { DataTableWithDrawerRows } from "../drawer/DataTableWithDrawerRows";
import { ListNavigationProvider } from "../pages/list-navigation";
import { ResourceListFilters } from "../pages/resource-list-filters";
import { ResourceListSearch } from "../pages/resource-list-search";
import { SavedViewsDropdown } from "../pages/SavedViewsDropdown";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  nav.router.push.mockReset();
  nav.router.replace.mockReset();
  nav.search = "";
});

const rows = Array.from({ length: 3 }, (_, i) => ({ id: String(i + 1), status: "open" }));

function table() {
  return (
    <ListNavigationProvider>
      <DataTableWithDrawerRows
        resource="matches"
        columns={[
          { field: "id", label: "ID", sortable: true },
          { field: "status", label: "Status", sortable: true },
        ]}
        rows={rows}
        total={60}
        page={1}
        pageSize={3}
        rowKey="id"
      />
    </ListNavigationProvider>
  );
}

describe("a list's history", () => {
  it("records a sort and a page change, so Back undoes the last one", () => {
    render(table());
    fireEvent.click(screen.getByRole("button", { name: /status/i }));
    expect(nav.router.push).toHaveBeenLastCalledWith("/admin/matches?sort=status%3Aasc", {
      scroll: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(nav.router.push).toHaveBeenLastCalledWith("/admin/matches?page=2", { scroll: true });
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it("replaces the entry while the search is typed", () => {
    vi.useFakeTimers();
    render(
      <ListNavigationProvider>
        <ResourceListSearch placeholder="Search matches…" />
      </ListNavigationProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText("Search matches…"), {
      target: { value: "harbor" },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(nav.router.replace).toHaveBeenCalledWith("/admin/matches?q=harbor", { scroll: false });
    expect(nav.router.push).not.toHaveBeenCalled();
  });
});

describe("a filter's history", () => {
  function filters() {
    return (
      <ListNavigationProvider>
        <ResourceListFilters
          filters={[
            { field: "confidence", label: "Confidence", type: "numeric-range" },
            { field: "model", label: "Model", type: "boolean" },
          ]}
        />
      </ListNavigationProvider>
    );
  }

  it("adds one entry per settled range, not one per keystroke", () => {
    vi.useFakeTimers();
    render(filters());
    const min = screen.getByLabelText("Min");
    for (const value of ["0", "0.", "0.8", "0.85"]) {
      fireEvent.change(min, { target: { value } });
      vi.advanceTimersByTime(200);
    }
    expect(nav.router.push).toHaveBeenCalledTimes(1);
    expect(nav.router.replace).toHaveBeenCalledTimes(3);
    expect(nav.router.replace).toHaveBeenLastCalledWith("/admin/matches?f_confidence=0.85%3A", {
      scroll: false,
    });
    vi.advanceTimersByTime(1500);
    fireEvent.change(min, { target: { value: "0.9" } });
    expect(nav.router.push).toHaveBeenCalledTimes(2);
  });

  it("adds an entry for each pick of a discrete filter", async () => {
    render(filters());
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Yes" }));
    expect(nav.router.push).toHaveBeenCalledTimes(1);
    expect(nav.router.replace).not.toHaveBeenCalled();
  });
});

describe("the saved-view button", () => {
  const views = [
    {
      name: "Needs review",
      filters: { status: "needs_review" },
      sort: { field: "confidence", dir: "asc" as const },
    },
    { name: "Confirmed", filters: { status: "confirmed" } },
  ];
  const defaults = { sort: { field: "confidence", dir: "asc" as const } };

  it.each([
    ["f_status=needs_review", "View: Needs review"],
    ["f_status=needs_review&sort=confidence%3Aasc&page=3&drawer=matches%3A4", "View: Needs review"],
    ["f_status=confirmed", "View: Confirmed"],
    ["", "View: All"],
    ["f_status=rejected", "Views"],
  ])("reads ?%s as %s", (query, label) => {
    nav.search = query;
    render(<SavedViewsDropdown resource="matches" staticViews={views} defaults={defaults} />);
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });

  it("keeps the page size and the open drawer when it applies a view", async () => {
    nav.search = "pageSize=50&drawer=matches%3A4&f_model=gpt&page=2";
    render(<SavedViewsDropdown resource="matches" staticViews={views} defaults={defaults} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Views" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Confirmed" }));
    expect(nav.router.push).toHaveBeenCalledWith(
      "/admin/matches?pageSize=50&drawer=matches%3A4&f_status=confirmed",
      { scroll: false },
    );
  });
});
