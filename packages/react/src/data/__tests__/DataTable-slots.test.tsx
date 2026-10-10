// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import type { EmptyStateProps } from "../../feedback/EmptyStateDefault";
import type { SkeletonTableProps } from "../../feedback/SkeletonTableDefault";
import { ComponentsProvider } from "../../provider/ComponentsContext";
import { DataTable } from "../DataTable";
import { MobileCardList } from "../MobileCardList";

function BrandEmpty({ title, description, icon }: EmptyStateProps) {
  return (
    <p data-testid="brand-empty">
      {title} · {description} · {icon}
    </p>
  );
}

function BrandSkeleton({ rows, columns }: SkeletonTableProps) {
  return <p data-testid="brand-skeleton">{`${rows}x${columns}`}</p>;
}

const columns = [
  { field: "email", label: "Email" },
  { field: "name", label: "Name" },
];

afterEach(cleanup);

describe("DataTable under host slot overrides", () => {
  it("renders the host's EmptyState for an empty list, with the list's text and icon", () => {
    render(
      <ComponentsProvider value={{ EmptyState: BrandEmpty }}>
        <DataTable
          columns={columns}
          rows={[]}
          total={0}
          page={1}
          pageSize={20}
          rowKey="email"
          emptyTitle="No customers"
          emptyDescription="Invite one"
          emptyIcon="★"
        />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("brand-empty").textContent).toBe("No customers · Invite one · ★");
  });

  it("renders the host's SkeletonTable while loading, sized to the table", () => {
    render(
      <ComponentsProvider value={{ SkeletonTable: BrandSkeleton }}>
        <DataTable
          columns={columns}
          rows={[]}
          total={0}
          page={1}
          pageSize={20}
          rowKey="email"
          loading
        />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("brand-skeleton").textContent).toBe("5x2");
  });

  it("keeps its own empty state and skeleton without overrides", () => {
    const { container } = render(
      <DataTable columns={columns} rows={[]} total={0} page={1} pageSize={20} rowKey="email" />,
    );
    expect(screen.getByText("No results")).toBeTruthy();
    expect(container.querySelector(".fp-font-medium")?.textContent).toBe("No results");
  });

  it("uses the host's EmptyState in the mobile card list too", () => {
    render(
      <ComponentsProvider value={{ EmptyState: BrandEmpty }}>
        <MobileCardList columns={columns} rows={[]} rowKey="email" emptyTitle="Nothing here" />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("brand-empty").textContent).toContain("Nothing here");
  });
});
