// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
let query = "tab=scores&f_role=admin";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/users/u1",
  useSearchParams: () => new URLSearchParams(query),
}));

import { RelatedTabTable } from "../RelatedTabTable";

afterEach(() => {
  cleanup();
  push.mockClear();
  query = "tab=scores&f_role=admin";
});

const props = {
  pageParam: "relatedPage.scores",
  columns: [{ field: "value" as const }],
  rows: [{ id: "s1", value: 1 }],
  total: 26,
  page: 1,
  pageSize: 25,
  rowKey: "id" as const,
};

describe("paging a related tab", () => {
  it("keeps every other URL parameter and does not jump to the top", () => {
    render(<RelatedTabTable {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(push).toHaveBeenCalledTimes(1);
    const [url, options] = push.mock.calls[0] as [string, { scroll?: boolean }];
    expect(url).toContain("tab=scores");
    expect(url).toContain("f_role=admin");
    expect(url).toContain("relatedPage.scores=2");
    expect(url.startsWith("/admin/users/u1?")).toBe(true);
    expect(options).toEqual({ scroll: false });
  });

  it("drops its own key on the way back to the first page", () => {
    query = "tab=scores&relatedPage.scores=2";
    render(<RelatedTabTable {...props} page={2} rows={[{ id: "s26", value: 26 }]} />);
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    const [url] = push.mock.calls[0] as [string];
    expect(url).toBe("/admin/users/u1?tab=scores");
  });

  it("still offers a way back when the requested page has no rows", () => {
    render(<RelatedTabTable {...props} page={2} rows={[]} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeTruthy();
  });

  it("renders the rows it was given rather than keeping its own copy", () => {
    const { rerender } = render(<RelatedTabTable {...props} rows={[{ id: "s7", value: 7 }]} />);
    expect(screen.getByRole("cell", { name: "7" })).toBeTruthy();
    rerender(<RelatedTabTable {...props} page={2} rows={[{ id: "s26", value: 26 }]} />);
    expect(screen.getByRole("cell", { name: "26" })).toBeTruthy();
    expect(screen.queryByRole("cell", { name: "7" })).toBeNull();
  });
});
