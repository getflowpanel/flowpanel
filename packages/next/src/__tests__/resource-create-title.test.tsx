import type { Adapter, ResourceOptions } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { PageHeader } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceCreatePage } from "../pages/resource-create.js";

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

async function titleFor(options: ResourceOptions<Record<string, unknown>>): Promise<unknown> {
  const config = defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
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
});
