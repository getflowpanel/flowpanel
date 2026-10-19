import type { Adapter } from "@flowpanel/core";
import {
  DE_LABELS,
  DEFAULT_LABELS,
  defineAdmin,
  FlowpanelValidationError,
  resource,
} from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { drawerRoute } from "../drawer/drawer-route";
import { auditFeedItems } from "../pages/audit/audit-feed";
import { explainConstraint } from "../runtime/constraint-error";
import { fieldLabels, namedFields } from "../runtime/field-labels";
import { prerenderResourceCells } from "../runtime/prerender-cells";
import { declaredFormFields } from "../runtime/resolve-form-fields";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "products",
    columns: [
      { name: "id", type: "number", nullable: false, unique: true, primaryKey: true },
      { name: "sku", type: "string", nullable: false, unique: true, primaryKey: false },
      { name: "vip", type: "boolean", nullable: false, unique: false, primaryKey: false },
      { name: "body", type: "string", nullable: true, unique: false, primaryKey: false },
      { name: "priceCents", type: "number", nullable: false, unique: false, primaryKey: false },
      { name: "customerId", type: "number", nullable: false, unique: false, primaryKey: false },
    ],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => ({ id: 7, vip: true, sku: "A-1" }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource({ __name: "customers" }, { columns: ["id"] }),
    resource(
      { __name: "accounts" },
      {
        columns: ["id", { field: "vip", label: "Status", render: (row) => (row.vip ? "VIP" : "") }],
        create: { fields: [{ name: "vip", label: "VIP" }] },
        update: { fields: [{ name: "vip", label: "VIP" }] },
        drawer: { fields: "*" },
      },
    ),
    resource(
      { __name: "products" },
      {
        columns: [
          "id",
          { field: "sku", label: "Artikelnummer" },
          { field: "priceCents", format: { kind: "money", currency: "EUR", minorUnits: 2 } },
          { field: "customerId", reference: { resource: "customers", labelField: "sku" } },
        ],
        create: { fields: [{ name: "sku" }, { name: "vip", label: "VIP-Kunde" }] },
        drawer: { fields: [{ name: "body", label: "Nachricht" }] },
      },
    ),
  ],
});
const products = config.resourcesByName.get("products");
if (!products) throw new Error("fixture: resource not registered");

describe("one label per field", () => {
  const labelOf = fieldLabels(products);

  it("takes the label a form, record or drawer field declares before a column's", () => {
    expect(["sku", "vip", "body"].map(labelOf)).toEqual([
      "Artikelnummer",
      "VIP-Kunde",
      "Nachricht",
    ]);
  });

  it("humanizes the rest by what the field is", () => {
    expect(["id", "priceCents", "customerId", "durationMs"].map(labelOf)).toEqual([
      "ID",
      "Price",
      "Customer",
      "Duration (ms)",
    ]);
  });

  it("lets a surface's own label win", () => {
    expect(fieldLabels(products, [{ name: "sku", label: "SKU" }])("sku")).toBe("SKU");
  });

  it("reaches list headers, forms and constraint errors", () => {
    const { columns } = prerenderResourceCells(products.options.columns ?? [], [], {} as never, {
      labelOf,
    });
    expect(columns.map((column) => column.label)).toEqual([
      "ID",
      "Artikelnummer",
      "Price",
      "Customer",
    ]);
    expect(declaredFormFields(products, "create")?.map((field) => field.label)).toEqual([
      "Artikelnummer",
      "VIP-Kunde",
    ]);
    const taken = explainConstraint(
      { code: "23505", detail: "Key (sku)=(A-1) already exists." },
      config,
      products,
      "create",
    );
    expect(taken instanceof FlowpanelValidationError && taken.fieldErrors).toEqual({
      sku: "Artikelnummer is already taken",
    });
  });
});

describe("a render-only column labelled for its cell, as in the ADV app", () => {
  const accounts = config.resourcesByName.get("accounts");
  if (!accounts) throw new Error("fixture: resource not registered");
  const reader = {
    requestId: "r1",
    req: new Request("http://localhost/admin/audit-log"),
    session: { id: "me" },
    role: "admin",
    scope: null,
    ip: null,
    userAgent: null,
  };

  it("keeps its header, while History, the drawer and errors use the form's label", async () => {
    const { columns } = prerenderResourceCells(accounts.options.columns ?? [], [], {} as never, {
      labelOf: fieldLabels(accounts),
    });
    expect(columns.map((column) => column.label)).toEqual(["ID", "Status"]);

    const [event] = await auditFeedItems(
      config,
      reader,
      [
        {
          id: "e1",
          actorId: "me",
          actorName: "Me",
          action: "accounts.update",
          resource: "accounts",
          targetId: "7",
          diff: { before: { vip: false }, after: { vip: true } },
          at: new Date(),
        },
      ],
      DEFAULT_LABELS.audit,
      { linkRecords: false },
    );
    expect(event?.changes.map((change) => change.label)).toEqual(["VIP"]);

    const res = await drawerRoute(config)(
      new Request("http://localhost/api/flowpanel/drawer/accounts/7"),
      {
        params: Promise.resolve({ resource: "accounts", id: "7" }),
      },
    );
    expect(((await res.json()) as { labels: Record<string, string> }).labels.vip).toBe("VIP");

    const taken = explainConstraint(
      { code: "23505", detail: "Key (vip)=(t) already exists." },
      config,
      accounts,
      "update",
    );
    expect(taken instanceof FlowpanelValidationError && taken.fieldErrors).toEqual({
      vip: "VIP is already taken",
    });
  });
});

describe("system columns in the admin's language", () => {
  const german = defineAdmin({
    adapter: {
      ...adapter,
      introspect: () => ({
        name: "tickets",
        columns: [
          { name: "id", type: "number", nullable: false, unique: true, primaryKey: true },
          { name: "subject", type: "string", nullable: false, unique: false, primaryKey: false },
          { name: "createdAt", type: "date", nullable: false, unique: false, primaryKey: false },
          { name: "updated_at", type: "date", nullable: false, unique: false, primaryKey: false },
        ],
        primaryKey: "id",
      }),
      get: async () => ({
        id: 3,
        subject: "Login",
        createdAt: new Date(0),
        updated_at: new Date(0),
      }),
    },
    auth: { session: async () => null, role: () => "admin" },
    labels: DE_LABELS,
    resources: [
      resource(
        { __name: "tickets" },
        {
          columns: ["subject", "createdAt", { field: "updated_at", label: "Zuletzt" }],
          drawer: { fields: "*" },
        },
      ),
    ],
  });
  const tickets = german.resourcesByName.get("tickets");
  if (!tickets) throw new Error("fixture: resource not registered");

  it("names id, createdAt and updated_at from the preset unless something labels them", () => {
    const labelOf = fieldLabels(tickets, [], namedFields(german));
    expect(["id", "createdAt", "updated_at", "subject"].map(labelOf)).toEqual([
      "ID",
      "Erstellt am",
      "Zuletzt",
      "Subject",
    ]);
  });

  it("reaches a German drawer", async () => {
    const res = await drawerRoute(german)(
      new Request("http://localhost/api/flowpanel/drawer/tickets/3"),
      { params: Promise.resolve({ resource: "tickets", id: "3" }) },
    );
    const { labels } = (await res.json()) as { labels: Record<string, string> };
    expect(labels.createdAt).toBe("Erstellt am");
  });
});
