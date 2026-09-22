import type { Adapter, ColumnMeta, ResourceOptions } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { AutoForm } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
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
  onGet?: (ctx: { select?: readonly string[] }) => void,
): Promise<Record<string, unknown>> {
  const adapter = adapterFor(row, columns);
  adapter.get = async (_ref, ctx) => {
    onGet?.(ctx);
    return row;
  };
  const config = defineAdmin({
    adapter,
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
  { name: "internalLock", type: "boolean", nullable: true, unique: false, primaryKey: false },
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

  it("selects and reprojects only readable form values and declared edit dependencies", async () => {
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

    const selects: string[][] = [];
    const props = await autoFormProps(
      row,
      columns,
      {
        columns: ["id", "title", "readOnlyTitle", "writeOnly", "secret", "readDenied"],
        update: {
          expose: ["internalLock"],
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
      },
      (ctx) => {
        selects.push([...(ctx.select ?? [])]);
      },
    );

    expect(selects).toEqual([["title", "readOnlyTitle", "hiddenValue", "internalLock"]]);

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
    expect(hiddenRows).toEqual([
      {
        title: "Visible title",
        readOnlyTitle: "Visible read-only title",
        hiddenValue: "must not cross the boundary",
        internalLock: true,
      },
    ]);
    expect(readOnlyRows).toEqual([
      {
        title: "Visible title",
        readOnlyTitle: "Visible read-only title",
        hiddenValue: "must not cross the boundary",
        internalLock: true,
      },
    ]);
  });

  it("projects implicit defaults from the rendered writable columns and never from the primary key", async () => {
    const selects: string[][] = [];
    const props = await autoFormProps(
      {
        id: "c1",
        title: "Visible title",
        writeOnly: "must not cross the boundary",
        secret: "must not cross the boundary",
        readDenied: "must not cross the boundary",
        internalLock: true,
        adapterOnly: "must not cross the boundary",
      },
      columns,
      {
        columns: ["id", "title", "writeOnly", "secret", "readDenied"],
        update: { expose: ["internalLock"] },
        fieldAccess: {
          writeOnly: { read: false, write: true },
          secret: { sensitive: true, write: true },
          readDenied: { read: "admin" },
        },
      },
      (ctx) => {
        selects.push([...(ctx.select ?? [])]);
      },
    );

    expect((props.columns as ColumnMeta[]).map((column) => column.name)).toEqual([
      "title",
      "writeOnly",
      "secret",
      "readDenied",
    ]);
    expect(props.defaultValues).toEqual({ title: "Visible title" });
    expect(selects).toEqual([["title", "internalLock"]]);
  });

  it("uses one policy decision, retains scope, and keeps exposed dependencies out of defaults", async () => {
    const adapter = adapterFor(
      { id: "c1", title: "Visible title", internalLock: true, token: "adapter leak" },
      columns,
    );
    const get = vi.fn(
      async (
        _ref: unknown,
        _ctx: {
          select?: readonly string[];
          scopeRequired?: boolean;
          applyScope?: (query: unknown) => unknown;
        },
      ) => ({ id: "c1", title: "Visible title", internalLock: true, token: "adapter leak" }),
    );
    adapter.get = get;
    let titlePolicyCalls = 0;
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "editor" },
      scope: () => ({ tenantId: "t1" }),
      resources: [
        resource(
          { __name: "customers" },
          {
            columns: ["id", "title"],
            scope: (scope, query) => ({ scope, query }),
            update: { fields: [{ name: "title" }], expose: ["internalLock"] },
            fieldAccess: {
              title: {
                read: async () => {
                  titlePolicyCalls += 1;
                  return true;
                },
              },
            },
          },
        ),
      ],
    });
    const resourceConfig = config.resourcesByName.get("customers");
    if (!resourceConfig) throw new Error("fixture: resource not registered");

    const tree = await ResourceEditPage({
      config,
      resource: resourceConfig,
      name: "customers",
      id: "c1",
      req: new Request("http://localhost/admin/customers/c1/edit"),
      reqCtx: {
        req: new Request("http://localhost/admin/customers/c1/edit"),
        role: "editor",
        session: null,
        scope: { tenantId: "t1" },
        ip: null,
        userAgent: null,
      },
    });
    const props = findElement(tree, AutoForm);
    if (!props) throw new Error("fixture: AutoForm not rendered");

    expect(titlePolicyCalls).toBe(1);
    expect(get.mock.calls[0]?.[1].select).toEqual(["title", "internalLock"]);
    expect(get.mock.calls[0]?.[1].scopeRequired).toBe(true);
    expect(get.mock.calls[0]?.[1].applyScope?.("query")).toEqual({
      scope: { tenantId: "t1" },
      query: "query",
    });
    expect(props.defaultValues).toEqual({ title: "Visible title" });
  });

  it("never resolves a denied current reference value, but resolves a readable one", async () => {
    async function renderReference(read: boolean) {
      const customerColumns = [
        { name: "id", type: "string" as const, nullable: false, unique: true, primaryKey: true },
        {
          name: "ownerId",
          type: "reference" as const,
          nullable: true,
          unique: false,
          primaryKey: false,
        },
      ];
      const userColumns = [
        { name: "id", type: "string" as const, nullable: false, unique: true, primaryKey: true },
        {
          name: "email",
          type: "string" as const,
          nullable: false,
          unique: true,
          primaryKey: false,
        },
      ];
      const adapter = adapterFor({ id: "c1", ownerId: "u42" }, customerColumns);
      adapter.introspect = (ref) =>
        (ref as { __name?: string }).__name === "users"
          ? { name: "users", columns: userColumns, primaryKey: "id" }
          : { name: "customers", columns: customerColumns, primaryKey: "id" };
      const list = vi.fn(async () => ({
        rows: [{ id: "u42", email: "owner@example.test" }],
        total: 1,
        page: 1,
        pageSize: 1,
      }));
      adapter.list = list;
      const get = vi.fn(async (_ref: unknown, _ctx: { select?: readonly string[] }) => ({
        id: "c1",
        ownerId: "u42",
      }));
      adapter.get = get;
      const config = defineAdmin({
        adapter,
        auth: { session: async () => null, role: () => "editor" },
        resources: [
          resource(
            { __name: "customers" },
            {
              columns: ["id", "ownerId"],
              update: {
                fields: [
                  { name: "ownerId", reference: { resource: "users", labelField: "email" } },
                ],
              },
              fieldAccess: { ownerId: { read } },
            },
          ),
          resource({ __name: "users" }, { columns: ["id", "email"] }),
        ],
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
      return { get, list, props };
    }

    const denied = await renderReference(false);
    expect(denied.get.mock.calls[0]?.[1].select).toEqual([]);
    expect((denied.props.fields as Array<{ options?: unknown }>)[0]?.options).toEqual([]);
    expect(denied.list).not.toHaveBeenCalled();

    const readable = await renderReference(true);
    expect(readable.get.mock.calls[0]?.[1].select).toEqual(["ownerId"]);
    expect((readable.props.fields as Array<{ options?: unknown }>)[0]?.options).toEqual([
      { value: "u42", label: "owner@example.test" },
    ]);
    expect(readable.list).toHaveBeenCalledTimes(1);
  });
});
