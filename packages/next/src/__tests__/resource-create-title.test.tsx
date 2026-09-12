import type { Adapter, LabelsConfig, ResourceOptions } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceCreatePage } from "../pages/resource-create";

function findElement(tree: ReactNode, type: unknown): Record<string, unknown> | null {
  if (tree === null || tree === undefined || typeof tree !== "object") return null;
  if (Array.isArray(tree)) {
    for (const c of tree) {
      const hit = findElement(c, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(tree)) return null;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === type) return el.props;
  return findElement(el.props.children, type);
}

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "customers",
    columns: [{ name: "id", type: "string", nullable: false, unique: true, primaryKey: true }],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

async function titleFor(
  options: ResourceOptions<Record<string, unknown>>,
  labels?: LabelsConfig,
): Promise<unknown> {
  const config = defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    ...(labels ? { labels } : {}),
    resources: [resource({ __name: "customers" }, options)],
  });
  const r = config.resourcesByName.get("customers");
  if (!r) throw new Error("fixture: resource not registered");
  const tree = await ResourceCreatePage({
    config,
    resource: r,
    name: "customers",
    req: new Request("http://localhost/admin/customers/new"),
  });
  return findElement(tree, PageHeader)?.title;
}

describe("ResourceCreatePage title", () => {
  it("fails closed when global scope is active and the resource has no scope", async () => {
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      scope: () => ({ tenantId: "t1" }),
      resources: [resource({ __name: "customers" }, { columns: ["id"] })],
    });
    const resourceConfig = config.resourcesByName.get("customers");
    if (!resourceConfig) throw new Error("fixture: resource not registered");

    await expect(
      ResourceCreatePage({
        config,
        resource: resourceConfig,
        name: "customers",
        req: new Request("http://localhost/admin/customers/new"),
      }),
    ).rejects.toThrow(/missing scope/i);
  });

  it("prefers labelOne", async () => {
    await expect(
      titleFor({ columns: ["id"], label: "Customers", labelOne: "Customer" }),
    ).resolves.toBe("New Customer");
  });

  it("falls back to label", async () => {
    await expect(titleFor({ columns: ["id"], label: "Customers" })).resolves.toBe("New Customers");
  });

  it("falls back to the resource name", async () => {
    await expect(titleFor({ columns: ["id"] })).resolves.toBe("New customers");
  });

  it("uses the configured heading template and its {label} slot", async () => {
    await expect(
      titleFor(
        { columns: ["id"], labelOne: "Клиент" },
        { form: { createTitle: "Новая запись: {label}" } },
      ),
    ).resolves.toBe("Новая запись: Клиент");
  });
});

describe("ResourceCreatePage chrome", () => {
  it("labels the submit button and the cancel link from the configuration", async () => {
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      labels: { actions: { create: "Создать", cancel: "Отмена" } },
      resources: [resource({ __name: "customers" }, { columns: ["id"], labelOne: "Клиент" })],
    });
    const r = config.resourcesByName.get("customers");
    if (!r) throw new Error("fixture: resource not registered");
    const tree = await ResourceCreatePage({
      config,
      resource: r,
      name: "customers",
      req: new Request("http://localhost/admin/customers/new"),
    });
    const form = findElement(tree, AutoForm);
    expect(form?.submitLabel).toBe("Создать");
    expect(form?.cancelHref).toBe("/admin/customers");
  });
});
