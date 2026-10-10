import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { CreateDrawerTrigger, DataTableWithDrawerRows } from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceListPage } from "../pages/resource-list";
import { findAll } from "./detail-fixture";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "orders",
    columns: [
      { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
      { name: "status", type: "string", nullable: false, unique: false, primaryKey: false },
    ],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async (_ref, ctx) => ({ rows: [], total: 0, page: ctx.page, pageSize: ctx.pageSize }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

type Empty = { title?: string; filtered?: string; searched?: string };

function admin(empty?: Empty, locale?: string, creatable = true) {
  return defineAdmin({
    adapter,
    ...(locale ? { formatting: { locale } } : {}),
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "orders" },
        {
          label: "Orders",
          labelOne: "Order",
          columns: ["id", "status"],
          ...(creatable ? {} : { create: { disabled: true } }),
          search: ["status"],
          filters: [{ field: "status", type: "select", options: ["paid", "open"] }],
          ...(empty ? { empty } : {}),
        },
      ),
    ],
  });
}

async function table(query: string, empty?: Empty, locale?: string, creatable = true) {
  const config = admin(empty, locale, creatable);
  const orders = config.resourcesByName.get("orders");
  if (!orders) throw new Error("orders is not registered");
  const tree = await ResourceListPage({
    config,
    resource: orders,
    searchParams: new URLSearchParams(query),
    req: new Request(`http://localhost/admin/orders?${query}`),
  });
  return findAll(tree as ReactNode, DataTableWithDrawerRows)[0] as {
    emptyTitle?: string;
    emptyDescription?: string;
    emptyAction?: ReactNode;
  };
}

function hrefOf(node: ReactNode): string | undefined {
  if (!isValidElement(node)) return undefined;
  const el = node as ReactElement<{ href?: string; children?: ReactNode }>;
  return el.props.href ?? hrefOf(el.props.children);
}

describe("an empty resource list", () => {
  it("says there is no data yet when nothing narrows it", async () => {
    const props = await table("");
    expect(props.emptyTitle).toBe("No orders");
    expect(props.emptyDescription).toBe("Orders you create show up here.");
    const action = props.emptyAction as ReactElement<{ label?: string }>;
    expect(action.type).toBe(CreateDrawerTrigger);
    expect(action.props.label).toBe("Create order");
  });

  it("offers no create button where nobody creates rows", async () => {
    const props = await table("", undefined, undefined, false);
    expect(props.emptyDescription).toBe("Orders show up here once they are recorded.");
    expect(props.emptyAction).toBeUndefined();
  });

  it("says nothing matches and offers to clear the filters and search, keeping the sort", async () => {
    const props = await table("f_status=paid&q=zzz&sort=status&page=3");
    expect(props.emptyTitle).toBe("Nothing matches the current filters.");
    expect(hrefOf(props.emptyAction)).toBe("/admin/orders?sort=status");
  });

  it("takes the host's words for the filtered case", async () => {
    const props = await table("q=zzz", { filtered: "No orders match" });
    expect(props.emptyTitle).toBe("No orders match");
  });

  it("names the search text in `searched`, and keeps the clear action", async () => {
    const empty = { filtered: "No orders match", searched: "Nothing found for «{query}»" };
    const searched = await table("q=zzzzqqq&sort=status", empty);
    expect(searched.emptyTitle).toBe("Nothing found for «zzzzqqq»");
    expect(hrefOf(searched.emptyAction)).toBe("/admin/orders?sort=status");
    expect((await table("f_status=paid", empty)).emptyTitle).toBe("No orders match");
  });

  it("fills `{query}` in `filtered` too", async () => {
    const props = await table("q=zzz", { filtered: "No orders for “{query}”" });
    expect(props.emptyTitle).toBe("No orders for “zzz”");
  });

  it("words the no-data title in the admin's locale", async () => {
    const props = await table("", undefined, "ru-RU");
    expect(props.emptyTitle).toBe("Orders: записей нет");
  });
});
