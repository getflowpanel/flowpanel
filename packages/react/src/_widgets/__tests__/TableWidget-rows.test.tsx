// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin",
}));

import { TableWidget } from "../TableWidget";

const rows = [
  { id: "1", name: "Ann" },
  { id: "2", name: "Bo" },
];
const columns = [{ field: "name" as const }];

describe("TableWidget row navigation", () => {
  beforeEach(() => {
    push.mockReset();
  });
  afterEach(cleanup);

  it("pushes the row's own href when the row is clicked", () => {
    render(
      <TableWidget rows={rows} columns={columns} rowKey="id" hrefs={["/admin/users/1", null]} />,
    );
    screen.getByText("Ann").click();
    expect(push).toHaveBeenCalledWith("/admin/users/1");
  });

  it("leaves a row with no href inert", () => {
    render(
      <TableWidget rows={rows} columns={columns} rowKey="id" hrefs={["/admin/users/1", null]} />,
    );
    screen.getByText("Bo").click();
    expect(push).not.toHaveBeenCalled();
  });

  it("does not make rows clickable without hrefs", () => {
    render(<TableWidget rows={rows} columns={columns} rowKey="id" />);
    screen.getByText("Ann").click();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("TableWidget heading and empty state", () => {
  afterEach(cleanup);

  it("links the heading to the full list", () => {
    render(
      <TableWidget
        label="Recent users"
        rows={rows}
        columns={columns}
        rowKey="id"
        seeAllHref="/admin/users"
        seeAllLabel="See all"
      />,
    );
    expect(screen.getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/admin/users");
  });

  it("uses a string empty state as the table's own empty title", () => {
    render(<TableWidget rows={[]} columns={columns} rowKey="id" emptyState="No users yet" />);
    expect(screen.getByText("No users yet")).toBeTruthy();
  });

  it("renders a node empty state in place of the table", () => {
    render(
      <TableWidget rows={[]} columns={columns} rowKey="id" emptyState={<em>Nothing to show</em>} />,
    );
    expect(screen.getByText("Nothing to show")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
