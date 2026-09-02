import type { Adapter, ColumnMeta, ResourceOptions } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { AutoForm } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceEditPage } from "../pages/resource-edit";

function findElement(tree: ReactNode, type: unknown): Record<string, unknown> | null {
  if (tree === null || tree === undefined || typeof tree !== "object") return null;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const hit = findElement(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(tree)) return null;
  const element = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (element.type === type) return element.props;
  return findElement(element.props.children, type);
}

function adapterFor(row: Record<string, unknown>, columns: ColumnMeta[]): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "customers", columns, primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => row,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

async function autoFormProps(
  row: Record<string, unknown>,
  columns: ColumnMeta[],
  options: ResourceOptions<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const config = defineAdmin({
    adapter: adapterFor(row, columns),
    auth: { session: async () => null, role: () => "editor" },
    resources: [resource({ __name: "customers" }, options as never)],
  });
  const resourceConfig = config.resourcesByName.get("customers");
  if (!resourceConfig) throw new Error("fixture: resource not registered");

  const tree = await ResourceEditPage({
    config,
    resource: resourceConfig,
    name: "customers",
    id: "c1",
    req: new Request("http://localhost/admin/customers/c1/edit"),
  });
  const props = findElement(tree, AutoForm);
  if (!props) throw new Error("fixture: AutoForm not rendered");
  return props;
}

const columns: ColumnMeta[] = [
  { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
  { name: "title", type: "string", nullable: false, unique: false, primaryKey: false },
  { name: "readOnlyTitle", type: "string", nullable: false, unique: false, primaryKey: false },
  { name: "writeOnly", type: "string", nullable: true, unique: false, primaryKey: false },
  { name: "secret", type: "string", nullable: true, unique: false, primaryKey: false },
  { name: "readDenied", type: "string", nullable: true, unique: false, primaryKey: false },
  { name: "hiddenValue", type: "string", nullable: true, unique: false, primaryKey: false },
  { name: "adminOnly", type: "string", nullable: true, unique: false, primaryKey: false },
];

describe("ResourceEditPage default values", () => {
  it("fails closed under global scope before loading an unscoped row", async () => {
    let getCalls = 0;
    const adapter = adapterFor({ id: "c1", title: "Visible title" }, columns);
    adapter.get = async () => {
      getCalls += 1;
      return { id: "c1", title: "Visible title" };
    };
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "editor" },
      scope: () => ({ tenantId: "t1" }),
      resources: [resource({ __name: "customers" }, { columns: ["id", "title"] })],
    });
    const resourceConfig = config.resourcesByName.get("customers");
    if (!resourceConfig) throw new Error("fixture: resource not registered");

    await expect(
      ResourceEditPage({
        config,
        resource: resourceConfig,
        name: "customers",
        id: "c1",
        req: new Request("http://localhost/admin/customers/c1/edit"),
      }),
    ).rejects.toThrow(/missing scope/i);
    expect(getCalls).toBe(0);
  });

  it("projects explicit fields after visibility and read policy while predicates keep the raw row", async () => {
    const row = {
      id: "c1",
      title: "Visible title",
      readOnlyTitle: "Visible read-only title",
      writeOnly: "must not cross the boundary",
      secret: "must not cross the boundary",
      readDenied: "must not cross the boundary",
      hiddenValue: "must not cross the boundary",
      adminOnly: "must not cross the boundary",
      adapterOnly: "must not cross the boundary",
      internalLock: true,
    };
    const hiddenRows: Partial<Record<string, unknown>>[] = [];
    const readOnlyRows: Partial<Record<string, unknown>>[] = [];

    const props = await autoFormProps(row, columns, {
      columns: ["id", "title", "readOnlyTitle", "writeOnly", "secret", "readDenied"],
      update: {
        fields: [
          { name: "title" },
          {
            name: "readOnlyTitle",
            readOnly: (values) => {
              readOnlyRows.push(values);
              return values.internalLock === true;
            },
          },
          { name: "writeOnly" },
          { name: "secret" },
          { name: "readDenied" },
          {
            name: "hiddenValue",
            hidden: (values) => {
              hiddenRows.push(values);
              return values.internalLock === true;
            },
          },
          { name: "adminOnly", requireRole: "admin" },
        ],
      },
      fieldAccess: {
        writeOnly: { read: false, write: true },
        secret: { sensitive: true, write: true },
        readDenied: { read: "admin" },
      },
    });

    expect((props.fields as { name: string }[]).map((field) => field.name)).toEqual([
      "title",
      "readOnlyTitle",
      "writeOnly",
      "secret",
      "readDenied",
    ]);
    expect(props.defaultValues).toEqual({
      title: "Visible title",
      readOnlyTitle: "Visible read-only title",
    });
    expect(hiddenRows).toEqual([row]);
    expect(readOnlyRows).toEqual([row]);
  });

  it("projects implicit defaults from the rendered writable columns and never from the primary key", async () => {
    const props = await autoFormProps(
      {
        id: "c1",
        title: "Visible title",
        writeOnly: "must not cross the boundary",
        secret: "must not cross the boundary",
        readDenied: "must not cross the boundary",
        adapterOnly: "must not cross the boundary",
      },
      columns,
      {
        columns: ["id", "title", "writeOnly", "secret", "readDenied"],
        fieldAccess: {
          writeOnly: { read: false, write: true },
          secret: { sensitive: true, write: true },
          readDenied: { read: "admin" },
        },
      },
    );

    expect((props.columns as ColumnMeta[]).map((column) => column.name)).toEqual([
      "id",
      "title",
      "writeOnly",
      "secret",
      "readDenied",
    ]);
    expect(props.defaultValues).toEqual({ title: "Visible title" });
  });
});
