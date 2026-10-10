// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../../data/DataTable";
import { AdminNav } from "../../shell/AdminNav";
import { KvCard } from "../../widgets/KvCard";
import { StatGroupCard } from "../../widgets/StatGroupCard";
import { LABEL_TEXT } from "../label-text";

afterEach(cleanup);

function expectQuietLabel(element: Element | null) {
  expect(element).toBeTruthy();
  expect(element?.className).not.toMatch(/\buppercase\b|\btracking-/);
  for (const part of LABEL_TEXT.split(" ")) expect(element?.className).toContain(part);
}

describe("labels read in sentence case", () => {
  it("in a kv card", () => {
    render(<KvCard items={[{ label: "Plan", value: "Pro" }]} />);
    expectQuietLabel(screen.getByText("Plan"));
  });

  it("in a stat group", () => {
    render(<StatGroupCard stats={[{ label: "Paid orders", value: 3 }]} />);
    expectQuietLabel(screen.getByText("Paid orders"));
  });

  it("in a table header", () => {
    const { container } = render(
      <DataTable
        rows={[{ id: "1", name: "Ada" }]}
        columns={[{ field: "name", label: "Name" }]}
        rowKey="id"
        total={1}
        page={1}
        pageSize={10}
      />,
    );
    expectQuietLabel(container.querySelector("thead"));
    expect(container.querySelector("thead th")?.className).toContain("fp-font-normal");
  });

  it("over a nav group", () => {
    render(
      <AdminNav
        currentPath="/admin"
        groups={[{ label: "Resources", items: [{ label: "Users", href: "/admin/users" }] }]}
      />,
    );
    expectQuietLabel(screen.getByText("Resources"));
  });
});

describe("the active nav item", () => {
  it("is neutral, so the accent stays for actions", () => {
    render(
      <AdminNav
        currentPath="/admin/users"
        groups={[{ items: [{ label: "Users", href: "/admin/users" }] }]}
      />,
    );
    const link = screen.getByRole("link", { name: "Users" });
    expect(link.className).not.toContain("fp-accent");
    expect(link.className).toContain("fp-bg-fill");
    expect(link.className).toContain("fp-text-ink");
  });
});
