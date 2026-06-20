// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable.js";

type User = { id: string; email: string; name: string };

const rows: User[] = [
  { id: "1", email: "a@b.co", name: "Alice" },
  { id: "2", email: "b@b.co", name: "Bob" },
];

describe("DataTable mobile card view", () => {
  beforeEach(() => {
    // Force the card-view branch: a matching `(max-width: 639px)` query.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("still renders pagination on mobile, not just the card list", () => {
    // Regression: the mobile branch used to early-return only <MobileCardList/>,
    // making rows past page 1 unreachable on a phone.
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={[{ field: "email", label: "Email" }]}
        rows={rows}
        total={30}
        page={1}
        pageSize={2}
        rowKey="id"
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText(/30 total/)).toBeTruthy();
    const next = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(2);
    // Cards are still there too.
    expect(screen.getByText("a@b.co")).toBeTruthy();
  });

  it("still renders the toolbar (export/import/density) on mobile", () => {
    render(
      <DataTable
        columns={[{ field: "email", label: "Email" }]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable
        showDensityToggle
      />,
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  });
});
