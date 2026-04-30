// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminNav } from "../AdminNav.js";

describe("AdminNav", () => {
  it("renders nav groups and items", () => {
    render(
      <AdminNav
        brandName="Admin"
        currentPath="/admin/users"
        groups={[
          { label: "People", items: [{ label: "Users", href: "/admin/users" }] },
          { label: "Billing", items: [{ label: "Invoices", href: "/admin/invoices" }] },
        ]}
      />,
    );
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /admin/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /users/i }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /invoices/i }).getAttribute("aria-current")).toBeNull();
  });
});
