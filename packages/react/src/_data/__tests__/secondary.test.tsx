// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable";
import { MobileCardList } from "../MobileCardList";

afterEach(() => cleanup());

type User = { id: string; name: string; email: string | null };
const rows: User[] = [
  { id: "1", name: "Ada", email: "ada@example.com" },
  { id: "2", name: "Bob", email: null },
];

describe("a column's secondary line", () => {
  it("shows under a plain cell in the table, and not for an empty value", () => {
    render(
      <DataTable
        columns={[{ field: "name", label: "Name", secondary: "email" }]}
        rows={rows}
        total={2}
        page={1}
        pageSize={10}
        rowKey="id"
      />,
    );
    const second = screen.getByText("ada@example.com");
    expect(second.className).toContain("text-fp-text-3");
    expect(second.previousElementSibling?.textContent).toBe("Ada");
    expect(screen.getByText("Bob").tagName).toBe("TD");
  });

  it("shows under a prerendered cell", () => {
    render(
      <DataTable
        columns={[{ field: "name", label: "Name", secondary: "email" }]}
        rows={rows}
        total={2}
        page={1}
        pageSize={10}
        rowKey="id"
        prerenderedCells={[[<b key="a">Ada L.</b>], [undefined]]}
      />,
    );
    expect(screen.getByText("Ada L.").parentElement?.nextElementSibling?.textContent).toBe(
      "ada@example.com",
    );
  });

  it("shows in the phone card list", () => {
    render(
      <MobileCardList
        columns={[{ field: "name", secondary: "email" }, { field: "id" }]}
        rows={rows}
        rowKey="id"
      />,
    );
    expect(screen.getByText("ada@example.com").className).toContain("text-fp-text-3");
  });

  it("renders a timestamp through LocalTime, like the cell itself", () => {
    const { container } = render(
      <DataTable
        columns={[{ field: "name", label: "Name", secondary: "joinedAt" }]}
        rows={[{ id: "1", name: "Ada", joinedAt: new Date("2026-09-22T23:30:00.000Z") }]}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
      />,
    );
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(
      "2026-09-22T23:30:00.000Z",
    );
  });
});
