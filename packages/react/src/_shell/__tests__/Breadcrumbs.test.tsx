// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Breadcrumbs } from "../Breadcrumbs.js";

afterEach(cleanup);

describe("Breadcrumbs", () => {
  it("renders null when items empty", () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders links for non-final items and plain text for the last", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: "Ada" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin");
    expect(screen.getByRole("link", { name: "Users" }).getAttribute("href")).toBe("/admin/users");
    expect(screen.queryByRole("link", { name: "Ada" })).toBeNull();
    const last = screen.getByText("Ada");
    expect(last.getAttribute("aria-current")).toBe("page");
  });
});
