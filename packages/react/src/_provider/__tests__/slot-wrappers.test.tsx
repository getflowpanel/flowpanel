// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComponentsProvider } from "../ComponentsContext.js";
import { EmptyState } from "../../_feedback/EmptyState.js";
import { MetricCard } from "../../_widgets/MetricCard.js";
import { Button, type ButtonProps } from "../../ui/button.js";
import { Badge, type BadgeProps } from "../../_atoms/Badge.js";
import { Avatar, type AvatarProps } from "../../_atoms/Avatar.js";
import { StatusBadge, type StatusBadgeProps } from "../../_atoms/StatusBadge.js";
import { PageHeader, type PageHeaderProps } from "../../_shell/PageHeader.js";
import { Pagination, type PaginationProps } from "../../_data/Pagination.js";
import { ConfirmDialog, type ConfirmDialogProps } from "../../_feedback/ConfirmDialog.js";
import { SkeletonTable, type SkeletonTableProps } from "../../_feedback/SkeletonTable.js";

afterEach(() => cleanup());

describe("EmptyState wrapper", () => {
  it("renders default", () => {
    render(<EmptyState title="No rows" />);
    expect(screen.getByText("No rows")).toBeTruthy();
  });
  it("renders override", () => {
    function Custom({ title }: { title: string }) {
      return <span data-testid="custom">{title.toUpperCase()}</span>;
    }
    render(
      <ComponentsProvider value={{ EmptyState: Custom }}>
        <EmptyState title="No rows" />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom").textContent).toBe("NO ROWS");
  });
});

describe("MetricCard wrapper", () => {
  it("renders default", () => {
    render(<MetricCard label="Users" value={42} />);
    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });
  it("renders override", () => {
    function Custom({ label, value }: { label: string; value: number | string }) {
      return (
        <div data-testid="custom-metric">
          {label}={String(value)}
        </div>
      );
    }
    render(
      <ComponentsProvider value={{ MetricCard: Custom }}>
        <MetricCard label="Users" value={42} />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-metric").textContent).toBe("Users=42");
  });
});

describe("Button wrapper", () => {
  it("renders default", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeTruthy();
  });
  it("renders override when registered", () => {
    function Custom(props: ButtonProps) {
      return (
        <button data-testid="custom-button" type="button">
          {props.children}
        </button>
      );
    }
    render(
      <ComponentsProvider value={{ Button: Custom }}>
        <Button>Click me</Button>
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-button")).toBeTruthy();
  });
});

describe("Badge wrapper", () => {
  it("renders default", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeTruthy();
  });
  it("renders override when registered", () => {
    function Custom(props: BadgeProps) {
      return <span data-testid="custom-badge">{props.children}</span>;
    }
    render(
      <ComponentsProvider value={{ Badge: Custom }}>
        <Badge>Active</Badge>
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-badge")).toBeTruthy();
  });
});

describe("Avatar wrapper", () => {
  it("renders default fallback initials", () => {
    render(<Avatar fallback="AB" />);
    expect(screen.getByText("AB")).toBeTruthy();
  });
  it("renders override when registered", () => {
    function Custom(props: AvatarProps) {
      return <div data-testid="custom-avatar">{props.fallback}</div>;
    }
    render(
      <ComponentsProvider value={{ Avatar: Custom }}>
        <Avatar fallback="AB" />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-avatar")).toBeTruthy();
  });
});

describe("StatusBadge wrapper", () => {
  it("renders default", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("active")).toBeTruthy();
  });
  it("renders override when registered", () => {
    function Custom(props: StatusBadgeProps) {
      return <span data-testid="custom-status-badge">{props.status}</span>;
    }
    render(
      <ComponentsProvider value={{ StatusBadge: Custom }}>
        <StatusBadge status="active" />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-status-badge")).toBeTruthy();
  });
});

describe("PageHeader wrapper", () => {
  it("renders default", () => {
    render(<PageHeader title="My Page" />);
    expect(screen.getByText("My Page")).toBeTruthy();
  });
  it("renders override when registered", () => {
    function Custom(props: PageHeaderProps) {
      return <header data-testid="custom-page-header">{props.title}</header>;
    }
    render(
      <ComponentsProvider value={{ PageHeader: Custom }}>
        <PageHeader title="My Page" />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-page-header")).toBeTruthy();
  });
});

describe("Pagination wrapper", () => {
  it("renders default", () => {
    render(<Pagination page={1} pageSize={10} total={100} />);
    expect(screen.getByText(/100 total/)).toBeTruthy();
  });
  it("renders override when registered", () => {
    function Custom(props: PaginationProps) {
      return <div data-testid="custom-pagination">page {props.page}</div>;
    }
    render(
      <ComponentsProvider value={{ Pagination: Custom }}>
        <Pagination page={2} pageSize={10} total={100} />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-pagination").textContent).toBe("page 2");
  });
});

describe("ConfirmDialog wrapper", () => {
  it("renders default when open", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Are you sure?"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Are you sure?")).toBeTruthy();
  });
  it("renders override when registered", () => {
    function Custom(props: ConfirmDialogProps) {
      return props.open ? <div data-testid="custom-confirm-dialog">{props.title}</div> : null;
    }
    render(
      <ComponentsProvider value={{ ConfirmDialog: Custom }}>
        <ConfirmDialog open={true} onOpenChange={() => {}} title="Delete?" onConfirm={() => {}} />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-confirm-dialog")).toBeTruthy();
  });
});

describe("SkeletonTable wrapper", () => {
  it("renders default", () => {
    render(<SkeletonTable rows={2} columns={2} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
  it("renders override when registered", () => {
    function Custom(props: SkeletonTableProps) {
      return <div data-testid="custom-skeleton-table">loading {props.rows} rows</div>;
    }
    render(
      <ComponentsProvider value={{ SkeletonTable: Custom }}>
        <SkeletonTable rows={3} columns={4} />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-skeleton-table").textContent).toBe("loading 3 rows");
  });
});
