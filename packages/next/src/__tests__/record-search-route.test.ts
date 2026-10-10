import type { Adapter, ColumnMeta } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { recordSearchRoute } from "../command/record-search";

const column = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: name === "id",
  primaryKey: name === "id",
});

const ROWS: Record<string, Record<string, unknown>[]> = {
  customers: [
    { id: "1", company: "Northwind Audio", email: "ops@northwind.test" },
    { id: "2", company: "Harbor Gaming", email: "maya@harbor.test" },
  ],
  invoices: [{ id: "9", number: "INV-9", email: "billing@northwind.test" }],
  notes: [{ id: "5", body: "northwind call" }],
  contacts: [{ id: "3", email: "lead@northwind.test", phone: "555" }],
};

function makeAdmin(role: string) {
  const list = vi.fn(async (ref: unknown, ctx: { search?: string; pageSize: number }) => {
    const table = (ref as { __name: string }).__name;
    const q = (ctx.search ?? "").toLowerCase();
    const rows = (ROWS[table] ?? []).filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(q)),
    );
    return {
      rows: rows.slice(0, ctx.pageSize),
      total: rows.length,
      page: 1,
      pageSize: ctx.pageSize,
    };
  });
  const adapter: Adapter = {
    kind: "test",
    db: {},
    introspect: (ref) => {
      const table = (ref as { __name: string }).__name;
      const sample = ROWS[table]?.[0] ?? { id: "" };
      return { name: table, primaryKey: "id", columns: Object.keys(sample).map(column) };
    },
    inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
    list,
    get: async () => null,
    create: async () => ({}),
    update: async () => null,
    delete: async () => undefined,
  };
  const config = defineAdmin({
    adapter,
    auth: { session: async () => ({ id: "operator" }), role: () => role },
    resources: [
      resource({ __name: "customers" } as never, {
        name: "customers",
        columns: ["company", "email"],
        search: ["company", "email"],
        drawer: { fields: "*" },
      }),
      resource({ __name: "invoices" } as never, {
        name: "invoices",
        columns: ["number", "email"],
        search: ["number", "email"],
        access: { read: "admin" },
      }),
      resource({ __name: "notes" } as never, { name: "notes", columns: ["body"] }),
      resource({ __name: "contacts" } as never, {
        name: "contacts",
        columns: ["email", "phone"],
        search: ["email"],
        fieldAccess: { email: { read: "admin" } },
      }),
    ],
  });
  return { route: recordSearchRoute(config), list };
}

const search = (q: string) => new Request(`http://localhost/api/flowpanel/palette/search?q=${q}`);

describe("record search for the command palette", () => {
  it("finds records through each searchable resource and links each to where its row opens", async () => {
    const { route } = makeAdmin("admin");
    const body = await (await route(search("northwind"))).json();
    expect(body.groups).toEqual([
      {
        resource: "customers",
        label: "Customers",
        items: [
          {
            title: "Northwind Audio",
            detail: "ops@northwind.test",
            href: "/admin/customers?drawer=customers%3A1",
          },
        ],
      },
      {
        resource: "invoices",
        label: "Invoices",
        items: [{ title: "INV-9", detail: "billing@northwind.test", href: "/admin/invoices/9" }],
      },
      {
        resource: "contacts",
        label: "Contacts",
        items: [{ title: "lead@northwind.test", href: "/admin/contacts/3" }],
      },
    ]);
  });

  it("leaves out a resource whose search fields the caller may not read, instead of unmatched rows", async () => {
    const { route, list } = makeAdmin("support");
    const body = await (await route(search("northwind"))).json();
    expect(body.groups.map((group: { resource: string }) => group.resource)).not.toContain(
      "contacts",
    );
    expect(list.mock.calls.some(([ref]) => (ref as { __name: string }).__name === "contacts")).toBe(
      false,
    );
  });

  it("leaves out a resource the caller may not read", async () => {
    const { route } = makeAdmin("support");
    const body = await (await route(search("northwind"))).json();
    expect(body.groups.map((group: { resource: string }) => group.resource)).toEqual(["customers"]);
  });

  it("waits for two characters before it reads anything", async () => {
    const { route, list } = makeAdmin("admin");
    const body = await (await route(search("n"))).json();
    expect(body.groups).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });
});
