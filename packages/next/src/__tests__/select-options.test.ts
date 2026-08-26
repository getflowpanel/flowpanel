import type { FieldDef } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { serializeDashboardAction } from "../actions/dashboard-action";
import { serializeActionFormField } from "../actions/serialize-action-field";
import { resolveFilterSpecs } from "../runtime/parse-list-params";
import { toWireOptions } from "../runtime/select-options";

const DECLARED = [
  { label: "High", value: 1 },
  { label: "Enabled", value: true },
  { label: "Pro", value: "pro" },
];

const WIRE = [
  { label: "High", value: "1" },
  { label: "Enabled", value: "true" },
  { label: "Pro", value: "pro" },
];

describe("toWireOptions", () => {
  it("stringifies every declared value, whatever its JS type", () => {
    expect(toWireOptions(DECLARED)).toEqual(WIRE);
  });

  it("expands the string shorthand into label === value", () => {
    expect(toWireOptions(["open", "closed"])).toEqual([
      { label: "open", value: "open" },
      { label: "closed", value: "closed" },
    ]);
  });

  it("accepts a mixed array, since a readonly string[] and SelectOption[] share the parameter", () => {
    expect(toWireOptions(["open", { label: "High", value: 1 }])).toEqual([
      { label: "open", value: "open" },
      { label: "High", value: "1" },
    ]);
  });
});

describe("every serializer normalizes options the same way", () => {
  const field = { name: "priority", options: DECLARED } as FieldDef<Record<string, unknown>>;

  it("row/bulk action form fields", () => {
    expect(serializeActionFormField(field).options).toEqual(WIRE);
  });

  it("dashboard action form fields", () => {
    const wire = serializeDashboardAction({
      key: "k",
      label: "L",
      form: [field],
      run: async () => ({ ok: true }) as never,
    });
    expect(wire.form?.[0]?.options).toEqual(WIRE);
  });

  it("list filters, from an inline array and from an async callback alike", async () => {
    const inline = await resolveFilterSpecs(
      [{ field: "priority", type: "select", options: DECLARED }],
      {},
    );
    const resolved = await resolveFilterSpecs(
      [{ field: "priority", type: "select", options: async () => DECLARED }],
      {},
    );
    expect(inline[0]?.options).toEqual(WIRE);
    expect(resolved[0]?.options).toEqual(WIRE);
  });
});
