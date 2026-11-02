// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTabs, tabsFolded } from "../AdminTabs";

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
  it("starts on the first tab and marks the current one", () => {
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
    expect(list.className).toContain("fp-flex-wrap");
    expect(list.firstElementChild?.textContent).toBe("Overview");
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

describe("tabsFolded", () => {
  const widths = [100, 120, 90, 110];

  it("folds nothing while every tab fits", () => {
    expect(tabsFolded(widths, 0, 432)).toEqual([]);
  });

  it("keeps the first tabs that fit and folds the rest", () => {
    expect(tabsFolded(widths, 0, 300)).toEqual([2, 3]);
  });

  it("keeps the active tab even when it comes late, folding the tabs before it", () => {
    expect(tabsFolded(widths, 3, 300)).toEqual([1, 2]);
  });
});
