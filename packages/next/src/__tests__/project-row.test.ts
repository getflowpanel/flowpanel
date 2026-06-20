import type { ResourceConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { declaredRowFields, projectRow } from "../runtime/project-row.js";

function resourceWith(options: Record<string, unknown>): ResourceConfig {
  return { __kind: "resource", ref: { __name: "r" }, options } as never;
}

describe("declaredRowFields", () => {
  it("unions string + ColumnDef columns and always includes rowKey", () => {
    const r = resourceWith({
      columns: ["id", "email", { field: "plan" }, { render: () => null }],
    });
    expect([...declaredRowFields(r)].sort()).toEqual(["email", "id", "plan"]);
  });

  it("adds the explicit rowKey when it isn't a declared column", () => {
    const r = resourceWith({ columns: ["email"], rowKey: "uuid" });
    expect(declaredRowFields(r)).toContain("uuid");
  });

  it("unions drawer.fields array + fields-kind tabs, but '*' contributes nothing extra", () => {
    const r = resourceWith({
      columns: ["id"],
      drawer: {
        fields: ["email", "plan"],
        tabs: [
          { key: "profile", label: "Profile", fields: "*" },
          { key: "billing", label: "Billing", fields: ["cardLast4"] },
          { key: "orders", label: "Orders", resource: "orders" },
        ],
      },
    });
    const fields = declaredRowFields(r);
    expect(fields.has("email")).toBe(true);
    expect(fields.has("plan")).toBe(true);
    expect(fields.has("cardLast4")).toBe(true);
    // "*" (the profile tab) must NOT expand the set to every DB column.
    expect(fields.size).toBe(4); // id, email, plan, cardLast4
  });

  it("unions detail.fields, detail.tabs and create/update form fields", () => {
    const r = resourceWith({
      columns: ["id"],
      detail: {
        fields: ["bio"],
        tabs: [{ key: "extra", label: "Extra", fields: ["notes"] }],
      },
      create: { fields: [{ name: "email" }] },
      update: { fields: [{ name: "plan" }] },
    });
    const fields = declaredRowFields(r);
    expect(fields.has("bio")).toBe(true);
    expect(fields.has("notes")).toBe(true);
    expect(fields.has("email")).toBe(true);
    expect(fields.has("plan")).toBe(true);
  });

  it("never includes a field only present as raw adapter output — password hash stays undeclared", () => {
    const r = resourceWith({ columns: ["id", "email"] });
    expect(declaredRowFields(r).has("passwordHash")).toBe(false);
  });
});

describe("projectRow", () => {
  const r = resourceWith({ columns: ["id", "email"] });

  it("keeps only declared fields present on the row", () => {
    const row = { id: "1", email: "a@b.co", passwordHash: "secret", internalFlag: true };
    const out = projectRow(r, row);
    expect(out).toEqual({ id: "1", email: "a@b.co" });
    expect(out).not.toHaveProperty("passwordHash");
    expect(out).not.toHaveProperty("internalFlag");
  });

  it("does not invent keys absent from the source row", () => {
    const row = { id: "1" };
    const out = projectRow(r, row);
    expect(out).toEqual({ id: "1" });
    expect(Object.keys(out)).toEqual(["id"]);
  });

  it("widens the kept set via extraFields for a single call", () => {
    const row = { id: "1", email: "a@b.co", computedScore: 42 };
    const out = projectRow(r, row, ["computedScore"]);
    expect(out).toEqual({ id: "1", email: "a@b.co", computedScore: 42 });
  });
});
