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

  it("renders a toned badge beside the title without adding a heading", () => {
    const { container } = render(
      <PageHeader title="Ada" badge={{ label: "Churned", tone: "warn" }} />,
    );
    expect(screen.getByText("Churned")).toBeTruthy();
    expect(container.querySelector("[data-tone='warn']")).toBeTruthy();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("defaults a badge without a tone rather than dropping it", () => {
    const { container } = render(<PageHeader title="Ada" badge={{ label: "Active" }} />);
    expect(container.querySelector("[data-tone='default']")).toBeTruthy();
  });

  it("lets actions wrap below the title at narrow widths", () => {
    const { container } = render(
      <PageHeader title="Ada" actions={<button type="button">E</button>} />,
    );
    const row = container.querySelector("header > div");
    expect(row?.className).toContain("flex-wrap");
  });
});
