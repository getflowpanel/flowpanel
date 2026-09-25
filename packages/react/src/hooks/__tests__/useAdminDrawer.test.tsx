// @vitest-environment happy-dom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let currentSearch = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users/u1",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { type AdminDrawer, useAdminDrawer } from "../useAdminDrawer";

function probe(): AdminDrawer {
  const seen: AdminDrawer[] = [];
  function Probe() {
    seen.push(useAdminDrawer());
    return null;
  }
  render(<Probe />);
  return seen.at(-1) as AdminDrawer;
}

afterEach(() => {
  cleanup();
  currentSearch = "";
  vi.restoreAllMocks();
});

describe("useAdminDrawer", () => {
  it("reads the drawer's own tab from drawerTab, then from tab", () => {
    currentSearch = "tab=responses&drawer=response:r1&drawerTab=main";
    expect(probe().state).toEqual({ resource: "response", id: "r1", tab: "main" });
    cleanup();
    currentSearch = "drawer=response:r1&tab=main";
    expect(probe().state.tab).toBe("main");
  });

  it("keeps the page's tab when the drawer switches tabs or closes", () => {
    const push = vi.spyOn(window.history, "pushState");
    currentSearch = "tab=responses&drawer=response:r1";
    const drawer = probe();
    act(() => drawer.open({ resource: "response", id: "r1", tab: "main" }));
    expect(push).toHaveBeenLastCalledWith(
      null,
      "",
      "/admin/users/u1?tab=responses&drawer=response%3Ar1&drawerTab=main",
    );
    act(() => drawer.close());
    expect(push).toHaveBeenLastCalledWith(null, "", "/admin/users/u1?tab=responses");
  });
});
