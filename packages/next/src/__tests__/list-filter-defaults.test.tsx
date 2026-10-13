// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/admin/users",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ListQueryContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DataTableWithDrawerRows, ResourceListFilters } from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { handlers } from "../handlers";
import { ResourceListPage } from "../pages/resource-list";
import { ResourceListFilters as FilterRow } from "../pages/resource-list-filters";
import { findAll } from "./detail-fixture";

let seen: Record<string, unknown> = {};

const adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "users",
    columns: [
      { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
      { name: "email", type: "string", nullable: false, unique: false, primaryKey: false },
      { name: "isTest", type: "boolean", nullable: false, unique: false, primaryKey: false },
      { name: "plan", type: "string", nullable: false, unique: false, primaryKey: false },
      { name: "role", type: "string", nullable: false, unique: false, primaryKey: false },
    ],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async (_ref: unknown, ctx: ListQueryContext<unknown>) => {
    seen = ctx.filters as Record<string, unknown>;
    return { rows: [], total: 0, page: ctx.page, pageSize: ctx.pageSize };
  },
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
} as unknown as Adapter;

const config = defineAdmin({
  adapter,
  auth: { session: async () => ({ userId: "u1" }), role: () => "admin" },
  resources: [
    resource(
      { __name: "users" },
      {
        columns: ["email", "isTest", "plan", "role"],
        search: ["email"],
        filters: [
          { field: "isTest", label: "Test accounts", type: "boolean", defaultValue: false },
          { field: "plan", type: "select", options: ["free", "pro"] },
          {
            field: "role",
            type: "select",
            options: ["user", "admin"],
            defaultValue: "user",
            hidden: true,
          },
        ],
      },
    ),
  ],
});

async function page(query: string) {
  seen = {};
  const users = config.resourcesByName.get("users");
  if (!users) throw new Error("users is not registered");
  const tree = await ResourceListPage({
    config,
    resource: users,
    searchParams: new URLSearchParams(query),
    req: new Request(`http://localhost/admin/users?${query}`),
  });
  return tree as ReactNode;
}

function hrefOf(node: ReactNode): string | undefined {
  if (!isValidElement(node)) return undefined;
  const el = node as ReactElement<{ href?: string; children?: ReactNode }>;
  return el.props.href ?? hrefOf(el.props.children);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  nav.search = "";
});

describe("a list filter's defaultValue", () => {
  it("applies while the URL names no value for the filter", async () => {
    await page("");
    expect(seen).toEqual({ isTest: "false", role: "user" });
  });

  it("yields to the operator's own value", async () => {
    await page("f_isTest=true&f_role=admin");
    expect(seen).toEqual({ isTest: "true", role: "admin" });
  });

  it("stays off once the URL clears it with an empty value", async () => {
    await page("f_isTest=&f_plan=");
    expect(seen).toEqual({ role: "user" });
  });

  it("serves the list API the same effective filters", async () => {
    seen = {};
    const get = (query: string) =>
      handlers(config).GET(new Request(`http://localhost/api/flowpanel/users${query}`), {
        params: Promise.resolve({ route: ["users"] }),
      });
    await get("");
    expect(seen).toEqual({ isTest: "false", role: "user" });
    await get("?filter.isTest=");
    expect(seen).toEqual({ role: "user" });
  });

  it("sends the control its default and keeps a hidden filter out of the bar", async () => {
    const bar = findAll(await page(""), ResourceListFilters)[0] as {
      filters: { field: string; defaultValue?: string; hidden?: boolean }[];
    };
    expect(bar.filters.map((f) => [f.field, f.defaultValue, f.hidden])).toEqual([
      ["isTest", "false", undefined],
      ["plan", undefined, undefined],
      ["role", "user", true],
    ]);
  });

  it("counts as narrowing, and clearing writes an empty value so the default stays off", async () => {
    const table = findAll(await page("sort=email:asc"), DataTableWithDrawerRows)[0] as {
      emptyTitle?: string;
      emptyAction?: ReactNode;
    };
    expect(table.emptyTitle).toBe("Nothing matches the current filters.");
    expect(hrefOf(table.emptyAction)).toBe("/admin/users?sort=email%3Aasc&f_isTest=");
  });
});

describe("ResourceListFilters with a default", () => {
  const specs = [
    { field: "isTest", label: "Test accounts", type: "boolean" as const, defaultValue: "false" },
    { field: "plan", type: "select" as const, options: [{ label: "Pro", value: "pro" }] },
    { field: "role", type: "select" as const, defaultValue: "user", hidden: true },
  ];

  it("shows the default as chosen and hides a hidden filter", () => {
    render(<FilterRow filters={specs} />);
    expect(screen.getByRole("combobox", { name: "Test accounts" }).textContent).toContain("No");
    expect(screen.queryByRole("combobox", { name: "Role" })).toBeNull();
  });

  it("writes an empty value when the operator clears a defaulted filter", () => {
    nav.search = "page=3";
    render(<FilterRow filters={specs} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.router.push).toHaveBeenCalledWith("/admin/users?f_isTest=", { scroll: false });
  });

  it("offers no clear action once the operator has cleared every default", () => {
    nav.search = "f_isTest=";
    render(<FilterRow filters={specs} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });
});
