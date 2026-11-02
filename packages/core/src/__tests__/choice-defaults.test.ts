import { describe, expect, it } from "vitest";
import type { Adapter } from "../index";
import { defineAdmin, resource } from "../index";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "products",
    columns: [
      { name: "id", type: "number", nullable: false, unique: true, primaryKey: true },
      { name: "category", type: "string", nullable: false, unique: false, primaryKey: false },
      { name: "tags", type: "json", nullable: true, unique: false, primaryKey: false },
    ],
    primaryKey: "id",
  }),
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function admin(options: Record<string, unknown>) {
  return () =>
    defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "u1" }), role: () => "admin", access: "admin" },
      resources: [resource({ __name: "products" }, { columns: ["id", "category"], ...options })],
    });
}

const categories = ["Headphones", "Phones", "Vacuums"];

describe("a choice field's default", () => {
  it("must be one of its options, with the near match and the options named", () => {
    expect(
      admin({
        create: {
          fields: [
            { name: "category", type: "select", options: categories, defaultValue: "Phone" },
          ],
        },
      }),
    ).toThrow(
      'resource "products" create.fields "category" defaultValue: "Phone" is not one of the field\'s options, so the form would start empty. Did you mean "Phones"? Options: "Headphones", "Phones", "Vacuums".',
    );
  });

  it("is checked from create.defaultValues and against { value, label } options", () => {
    expect(
      admin({
        create: {
          fields: [
            {
              name: "category",
              type: "radio",
              options: [{ value: "hp", label: "Headphones" }],
            },
          ],
          defaultValues: { category: "Headphones" },
        },
      }),
    ).toThrow('create.defaultValues.category: "Headphones" is not one of the field\'s options');
  });

  it("checks each value of a multiselect", () => {
    expect(
      admin({
        update: {
          fields: [
            {
              name: "tags",
              type: "multiselect",
              options: categories,
              defaultValue: ["Phones", "TV"],
            },
          ],
        },
      }),
    ).toThrow('update.fields "tags" defaultValue: "TV"');
  });

  it("passes an empty default, which starts the control on no choice", () => {
    expect(
      admin({
        create: {
          fields: [
            { name: "category", type: "select", options: categories, defaultValue: "" },
            { name: "tags", type: "multiselect", options: categories, defaultValue: [] },
          ],
        },
      }),
    ).not.toThrow();
  });

  it("passes a listed default, a computed one and options resolved per request", () => {
    expect(
      admin({
        create: {
          fields: [
            { name: "category", type: "select", options: categories, defaultValue: "Phones" },
            { name: "tags", type: "multiselect", options: async () => [], defaultValue: ["x"] },
          ],
        },
        update: {
          fields: [
            { name: "category", type: "select", options: categories, defaultValue: () => "x" },
          ],
        },
      }),
    ).not.toThrow();
  });
});
