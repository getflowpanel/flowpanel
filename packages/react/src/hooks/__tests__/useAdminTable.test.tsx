// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams("?page=2&sort=name:asc&f_plan=pro&f_status=active"),
  usePathname: () => "/admin/users",
}));

import { useAdminTable } from "../useAdminTable.js";

describe("useAdminTable", () => {
  beforeEach(() => pushMock.mockReset());

  it("parses URL into { page, sort, filters }", () => {
    const { result } = renderHook(() => useAdminTable());
    expect(result.current.page).toBe(2);
    expect(result.current.sort).toEqual({ field: "name", dir: "asc" });
    expect(result.current.filters).toEqual({ plan: "pro", status: "active" });
  });

  it("setFilter writes to URL and resets page", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setFilter("plan", "free"));
    expect(pushMock).toHaveBeenCalledTimes(1);
    const url = pushMock.mock.calls[0][0] as string;
    expect(url).toMatch(/\/admin\/users/);
    expect(url).toContain("f_plan=free");
    expect(url).not.toContain("page=2"); // reset
  });

  it("setFilter with null removes the key", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setFilter("plan", null));
    const url = pushMock.mock.calls[0][0] as string;
    expect(url).not.toContain("f_plan");
  });

  it("clearFilters removes all f_* keys but preserves page/sort", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.clearFilters());
    const url = pushMock.mock.calls[0][0] as string;
    expect(url).not.toContain("f_");
    expect(url).toContain("page=2");
    expect(url).toContain("sort=name%3Aasc");
  });

  it("setSort writes sort param, clearing when null", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setSort({ field: "email", dir: "desc" }));
    expect(pushMock.mock.calls[0][0]).toContain("sort=email%3Adesc");
    act(() => result.current.setSort(null));
    expect(pushMock.mock.calls[1][0]).not.toContain("sort=");
  });

  it("setPage writes page param", () => {
    const { result } = renderHook(() => useAdminTable());
    act(() => result.current.setPage(5));
    expect(pushMock.mock.calls[0][0]).toContain("page=5");
  });
});
