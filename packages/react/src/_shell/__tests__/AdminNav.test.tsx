// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminNav } from "../AdminNav";

describe("AdminNav", () => {
  it("renders nav groups and items", () => {
    render(
      <AdminNav
        brand={{ name: "Admin" }}
        currentPath="/admin/users"
        groups={[
          { label: "People", items: [{ label: "Users", href: "/admin/users", icon: "users" }] },
          { label: "Billing", items: [{ label: "Invoices", href: "/admin/invoices" }] },
        ]}
      />,
    );
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /admin/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /users/i }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /invoices/i }).getAttribute("aria-current")).toBeNull();
    expect(document.querySelector('[data-flowpanel-icon="users"]')).toBeTruthy();
    expect(screen.getByRole("navigation").getAttribute("data-flowpanel-nav")).toBe("");
  });

  it("folds a collapsible group under its label when it does not hold the current page", () => {
    const { container } = render(
      <AdminNav
        currentPath="/admin/users"
        groups={[
          { label: "Resources", items: [{ label: "Users", href: "/admin/users" }] },
          {
            label: "Journals",
            collapsible: true,
            items: [{ label: "Scraper runs", href: "/admin/scraper_run" }],
          },
        ]}
      />,
    );
    const details = container.querySelector("details");
    expect(details?.hasAttribute("open")).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toBe("Journals");
    expect(details?.querySelector('a[href="/admin/scraper_run"]')).toBeTruthy();
    expect(container.querySelectorAll("details")).toHaveLength(1);
  });

  it("opens a collapsible group that holds the current page", () => {
    const { container } = render(
      <AdminNav
        currentPath="/admin/scraper_run/7"
        groups={[
          {
            label: "Journals",
            collapsible: true,
            items: [{ label: "Scraper runs", href: "/admin/scraper_run" }],
          },
        ]}
      />,
    );
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(
      container.querySelector('a[href="/admin/scraper_run"]')?.getAttribute("aria-current"),
    ).toBe("page");
  });
});
