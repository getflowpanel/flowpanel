// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin",
}));

import { TableWidget } from "../TableWidget";

afterEach(cleanup);

describe("TableWidget with query columns in the 0.3.2 formats", () => {
  it("renders percent heat, duration, boolean and url cells from a query's own rows", () => {
    const { container } = render(
      <TableWidget
        rows={[
          { week: "2026-W38", w1: 0.42, p95: 7_500_000, paid: true, site: "https://kwork.ru" },
        ]}
        columns={[
          { field: "week" },
          { field: "w1", format: { kind: "percent", heat: true } },
          { field: "p95", format: "duration" },
          { field: "paid", format: "boolean" },
          { field: "site", format: "url" },
        ]}
        rowKey="week"
      />,
    );
    expect(container.querySelector("[data-heat='2']")?.textContent).toBe("42%");
    expect(screen.getAllByText("2 hr 5 min").length).toBeGreaterThan(0);
    expect(screen.getAllByText("✓").length).toBeGreaterThan(0);
    expect(container.querySelector("a[href='https://kwork.ru']")?.textContent).toBe("kwork.ru");
  });
});
