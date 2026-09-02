// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTabs } from "../AdminTabs";

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
});
