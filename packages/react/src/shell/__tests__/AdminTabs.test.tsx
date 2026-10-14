// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTabs, tabsCutOff } from "../AdminTabs";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminTabs", () => {
  it("keeps overflowing destinations discoverable to sighted and screen-reader users", () => {
    render(
      <AdminTabs
        groups={[
          {
            items: [
              { label: "Overview", href: "/admin", icon: "layout-dashboard" },
              { label: "Customers", href: "/admin/customers", icon: "users" },
            ],
          },
        ]}
        currentPath="/admin"
      />,
    );

    const list = screen.getByRole("list");
    expect(list.className).toContain("fp-scroll-fade-x");
    expect(list.getAttribute("aria-describedby")).toBe("admin-tabs-scroll-hint");
    expect(
      screen.getByText("More destinations are available by horizontal scrolling."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("marks its navigation the way every shell variant does", () => {
    render(
      <AdminTabs
        groups={[{ items: [{ label: "Overview", href: "/admin" }] }]}
        currentPath="/admin"
      />,
    );

    expect(screen.getByRole("navigation").getAttribute("data-flowpanel-nav")).toBe("");
  });
});

describe("tabsCutOff", () => {
  const strip = { left: 0, right: 300 };
  const tabs = [
    { href: "/a", box: { left: 0, right: 120 } },
    { href: "/b", box: { left: 120, right: 295 } },
    { href: "/c", box: { left: 295, right: 400 } },
  ];

  it("moves a tab that reaches under the faded end into More", () => {
    expect(tabsCutOff(strip, tabs, { start: false, end: true })).toEqual(["/b", "/c"]);
  });

  it("keeps a whole tab when that edge does not fade", () => {
    expect(tabsCutOff(strip, tabs, { start: false, end: false })).toEqual(["/c"]);
    expect(
      tabsCutOff(strip, [{ href: "/b", box: { left: 120, right: 288 } }], {
        start: false,
        end: true,
      }),
    ).toEqual([]);
  });
});
