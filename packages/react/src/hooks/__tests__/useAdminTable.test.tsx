// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const router = { push: pushMock, replace: replaceMock };
const DEFAULT_SEARCH = "?page=2&sort=name:asc&f_plan=pro&f_status=active";
// Next hands back the same instance for a given navigation; a fresh object per
// render would make every setter's identity change and hide the memoization bug.
let params = new URLSearchParams(DEFAULT_SEARCH);

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => params,
  usePathname: () => "/admin/users",
}));

import { useAdminTable } from "../useAdminTable";

describe("useAdminTable", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    params = new URLSearchParams(DEFAULT_SEARCH);
  });

  it("parses URL into { page, sort, filters }", () => {
    const { result } = renderHook(() => useAdminTable());
    expect(result.current.page).toBe(2);
    expect(result.current.sort).toEqual({ field: "name", dir: "asc" });
    expect(result.current.filters).toEqual({ plan: "pro", status: "active" });
  });

  it("clamps a negative or fractional ?page to a real page", () => {
    params = new URLSearchParams("?page=-5");
    const { result, rerender } = renderHook(() => useAdminTable());
    expect(result.current.page).toBe(1);
    params = new URLSearchParams("?page=2.7");
    rerender();
    expect(result.current.page).toBe(2);
    params = new URLSearchParams("?page=abc");
    rerender();
    expect(result.current.page).toBe(1);
  });

  it("setFilter writes to URL and resets page", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setFilter("plan", "free"));
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const url = replaceMock.mock.calls[0]![0] as string;
    expect(url).toMatch(/\/admin\/users/);
    expect(url).toContain("f_plan=free");
    expect(url).not.toContain("page=2"); // reset
    expect(replaceMock.mock.calls[0]![1]).toEqual({ scroll: false });
  });

  it("replaces rather than pushes, so Back leaves the list instead of walking filters", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setFilter("plan", "free"));
    act(() => result.current.setSearch("ann"));
    act(() => result.current.setSort({ field: "email", dir: "desc" }));
    act(() => result.current.setPage(3));
    expect(replaceMock).toHaveBeenCalledTimes(4);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("keeps setter identity stable across renders", () => {
    const { result, rerender } = renderHook(() => useAdminTable());
    const first = result.current;
    rerender();
    expect(result.current.setPage).toBe(first.setPage);
    expect(result.current.setPageSize).toBe(first.setPageSize);
    expect(result.current.setSearch).toBe(first.setSearch);
    expect(result.current.setSort).toBe(first.setSort);
    expect(result.current.setFilter).toBe(first.setFilter);
    expect(result.current.clearFilters).toBe(first.clearFilters);
  });

  it("setFilter with null removes the key", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setFilter("plan", null));
    const url = replaceMock.mock.calls[0]![0] as string;
    expect(url).not.toContain("f_plan");
  });

  it("clearFilters removes all f_* keys but preserves page/sort", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.clearFilters());
    const url = replaceMock.mock.calls[0]![0] as string;
    expect(url).not.toContain("f_");
    expect(url).toContain("page=2");
    expect(url).toContain("sort=name%3Aasc");
  });

  it("setSort writes sort param, clearing when null", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setSort({ field: "email", dir: "desc" }));
    expect(replaceMock.mock.calls[0]![0]).toContain("sort=email%3Adesc");
    act(() => result.current.setSort(null));
    expect(replaceMock.mock.calls[1]![0]).not.toContain("sort=");
  });

  it("setPage writes page param", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setPage(5));
    expect(replaceMock.mock.calls[0]![0]).toContain("page=5");
    expect(replaceMock.mock.calls[0]![1]).toEqual({ scroll: true });
  });
});
