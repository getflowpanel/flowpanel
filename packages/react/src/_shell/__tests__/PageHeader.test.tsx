// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "../PageHeader";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders custom inline heading content as one accessible h1", () => {
    render(
      <PageHeader
        title={
          <span>
            Ada Lovelace <small>Customer</small>
          </span>
        }
      />,
    );
    expect(screen.getByRole("heading", { name: "Ada Lovelace Customer", level: 1 })).toBeTruthy();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("renders title and optional description", () => {
    render(<PageHeader title="Users" description="12 active" />);
    expect(screen.getByRole("heading", { name: "Users", level: 1 })).toBeTruthy();
    expect(screen.getByText("12 active")).toBeTruthy();
  });

  it("renders breadcrumbs above title when provided", () => {
    render(
      <PageHeader
        title="Ada"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: "Ada" },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Admin" })).toBeTruthy();
  });

  it("omits breadcrumbs block when list is empty", () => {
    render(<PageHeader title="X" breadcrumbs={[]} />);
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });
});
