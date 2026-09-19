// @vitest-environment happy-dom

import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/users",
}));

import { DataTableWithDrawerRows } from "@flowpanel/next/client";
import { ResourceListPage } from "../pages/resource-list";

afterEach(() => {
  cleanup();
  push.mockClear();
});

const ROWS = [
  { id: "u1", email: "a@b.c" },
  { id: "u2", email: "d@e.f" },
];

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "users",
    columns: [
      { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
      { name: "email", type: "string", nullable: false, unique: true, primaryKey: false },
    ],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: ROWS, total: ROWS.length, page: 1, pageSize: 20 }),
  get: async () => ROWS[0],
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function findAll(tree: ReactNode, type: unknown, out: Record<string, unknown>[] = []) {
  if (tree === null || tree === undefined || typeof tree !== "object") return out;
  if (Array.isArray(tree)) {
    for (const child of tree) findAll(child, type, out);
    return out;
  }
  if (!isValidElement(tree)) return out;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === type) out.push(el.props);
  findAll(el.props.children, type, out);
  return out;
}

async function tableProps(options: Record<string, unknown>) {
  const config = defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin", requireRole: "admin" },
    resources: [resource({ __name: "users" }, options as never)],
  });
  const users = config.resourcesByName.get("users");
  if (!users) throw new Error("fixture: resource not registered");
  const tree = await ResourceListPage({
    config,
    resource: users,
    searchParams: new URLSearchParams(),
    req: new Request("http://localhost/admin/users"),
  });
  return findAll(tree, DataTableWithDrawerRows)[0];
}

describe("what a row click does, by configuration", () => {
  it("opens the detail page when the resource configures one and no drawer", async () => {
    const props = await tableProps({ columns: ["id", "email"], detail: { fields: ["email"] } });
    expect(props?.rowHrefs).toEqual(["/admin/users/u1", "/admin/users/u2"]);
    expect(props?.openDrawerOnRowClick).toBeUndefined();
  });

  it("opens the drawer when only a drawer is configured", async () => {
    const props = await tableProps({ columns: ["id", "email"], drawer: { fields: "*" } });
    expect(props?.openDrawerOnRowClick).toBe(true);
    expect(props?.rowHrefs).toBeUndefined();
  });

  it("leaves rows inert when the resource configures neither", async () => {
    const props = await tableProps({ columns: ["id", "email"] });
    expect(props?.rowHrefs).toBeUndefined();
    expect(props?.openDrawerOnRowClick).toBeUndefined();
  });

  it("lets an explicit rowClick win over both defaults", async () => {
    const detailOverDrawer = await tableProps({
      columns: ["id", "email"],
      drawer: { fields: "*" },
      rowClick: "detail",
    });
    expect(detailOverDrawer?.rowHrefs).toEqual(["/admin/users/u1", "/admin/users/u2"]);
    expect(detailOverDrawer?.openDrawerOnRowClick).toBeUndefined();

    const off = await tableProps({
      columns: ["id", "email"],
      detail: { fields: ["email"] },
      rowClick: false,
    });
    expect(off?.rowHrefs).toBeUndefined();
  });

  it("escapes an identifier that would otherwise address another record", async () => {
    const wild: Adapter = {
      ...adapter,
      list: async () => ({
        rows: [{ id: "a/b?c", email: "x@y.z" }],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    };
    const config = defineAdmin({
      adapter: wild,
      auth: { session: async () => null, role: () => "admin", requireRole: "admin" },
      resources: [
        resource({ __name: "users" }, { columns: ["id", "email"], detail: { fields: ["email"] } }),
      ],
    });
    const users = config.resourcesByName.get("users");
    if (!users) throw new Error("fixture: resource not registered");
    const tree = await ResourceListPage({
      config,
      resource: users,
      searchParams: new URLSearchParams(),
      req: new Request("http://localhost/admin/users"),
    });
    expect(findAll(tree, DataTableWithDrawerRows)[0]?.rowHrefs).toEqual(["/admin/users/a%2Fb%3Fc"]);
  });
});

describe("a table with detail destinations", () => {
  const props = {
    resource: "users",
    columns: [{ field: "email" as const }],
    rows: ROWS,
    total: 2,
    page: 1,
    pageSize: 20,
    rowKey: "id" as const,
  };

  it("navigates to the clicked row's own page", () => {
    render(
      <DataTableWithDrawerRows {...props} rowHrefs={["/admin/users/u1", "/admin/users/u2"]} />,
    );
    fireEvent.click(screen.getByText("d@e.f"));
    expect(push).toHaveBeenCalledWith("/admin/users/u2");
  });

  it("follows the same path on Enter and says so in the hint", () => {
    render(
      <DataTableWithDrawerRows {...props} rowHrefs={["/admin/users/u1", "/admin/users/u2"]} />,
    );
    const body = document.querySelector("tbody") as HTMLElement;
    expect(body.getAttribute("aria-label")).toMatch(/Enter opens/);
    fireEvent.focus(body);
    fireEvent.keyDown(body, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/admin/users/u1");
  });

  it("never navigates from a row the projection could not identify", () => {
    render(
      <DataTableWithDrawerRows
        {...props}
        rows={[{ email: "no@key.here" } as (typeof ROWS)[number]]}
        total={1}
        rowHrefs={[null]}
      />,
    );
    fireEvent.click(screen.getByText("no@key.here"));
    const body = document.querySelector("tbody") as HTMLElement;
    fireEvent.focus(body);
    fireEvent.keyDown(body, { key: "Enter" });
    expect(push).not.toHaveBeenCalled();
    expect(body.getAttribute("aria-label")).not.toMatch(/Enter opens/);
  });

  it("offers no navigation at all without destinations", () => {
    render(<DataTableWithDrawerRows {...props} />);
    fireEvent.click(screen.getByText("a@b.c"));
    expect(push).not.toHaveBeenCalled();
  });

  describe("on a phone, where the same rows are cards", () => {
    beforeEach(() => {
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
    afterEach(() => vi.unstubAllGlobals());

    it("navigates from the tapped card", () => {
      render(
        <DataTableWithDrawerRows {...props} rowHrefs={["/admin/users/u1", "/admin/users/u2"]} />,
      );
      const cards = screen.getAllByRole("button", { name: /^Open / });
      expect(cards).toHaveLength(2);
      fireEvent.click(cards[1] as HTMLElement);
      expect(push).toHaveBeenCalledWith("/admin/users/u2");
    });

    it("offers nothing on a card the projection could not identify", () => {
      render(
        <DataTableWithDrawerRows
          {...props}
          rows={[{ email: "no@key.here" } as (typeof ROWS)[number]]}
          total={1}
          rowHrefs={[null]}
        />,
      );
      expect(screen.queryByRole("button", { name: /^Open / })).toBeNull();
      fireEvent.click(screen.getByText("no@key.here"));
      expect(push).not.toHaveBeenCalled();
    });
  });
});
