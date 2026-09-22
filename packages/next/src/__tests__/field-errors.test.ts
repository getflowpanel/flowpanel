import type { ColumnMeta, FieldDef } from "@flowpanel/core";
import { DEFAULT_LABELS, mergeLabels, RU_LABELS } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { friendlyFieldErrors } from "../actions/field-pipeline";
import { coerceRowByColumns } from "../runtime/coerce-values";

const SCHEMA = z.object({
  email: z.string().min(1),
  priceCents: z.number(),
  note: z.string().max(3),
});

function errorsFor(
  input: Record<string, unknown>,
  fields?: FieldDef<Record<string, unknown>>[],
  labels = DEFAULT_LABELS,
) {
  const parsed = SCHEMA.safeParse(input);
  if (parsed.success) throw new Error("fixture: expected the schema to reject");
  return friendlyFieldErrors(fields, input, parsed.error, labels);
}

describe("what an empty required value says", () => {
  it("names the field and asks for it, rather than reporting a type", () => {
    const errors = errorsFor({ email: "", priceCents: 1, note: "ok" });
    expect(errors.email).toBe("Email is required");
  });

  it("uses the declared label when the form has one", () => {
    const errors = errorsFor({ email: "", priceCents: 1, note: "ok" }, [
      { name: "email", label: "Work address" },
    ]);
    expect(errors.email).toBe("Work address is required");
  });

  it("says the same thing for a missing value as for a cleared one", () => {
    expect(errorsFor({ priceCents: 1, note: "ok" }).email).toBe("Email is required");
    expect(errorsFor({ email: "a@b.c", note: "ok" }).priceCents).toBe("Price cents is required");
  });

  it("leaves a real schema message alone", () => {
    expect(errorsFor({ email: "a@b.c", priceCents: 1, note: "far too long" }).note).toMatch(/3/);
  });

  it("keeps an author's own message even when the value is empty", () => {
    const authored = z.object({
      slug: z.string().refine((v) => v.length > 2, "Pick a longer slug"),
      code: z.string().min(1, "Enter the code"),
      name: z.string().min(3, "At least three characters"),
    });
    const input = { slug: "", code: "", name: "" };
    const parsed = authored.safeParse(input);
    if (parsed.success) throw new Error("fixture: expected the schema to reject");
    const errors = friendlyFieldErrors(undefined, input, parsed.error, DEFAULT_LABELS);
    expect(errors).toEqual({
      slug: "Pick a longer slug",
      code: "Enter the code",
      name: "At least three characters",
    });
  });

  it("speaks the admin's language", () => {
    const errors = errorsFor({ email: "", priceCents: 1, note: "ok" }, undefined, RU_LABELS);
    expect(errors.email).toBe("Заполните поле «Email»");
  });

  it("reports one message per field, the first that applies", () => {
    const errors = errorsFor({ email: "", note: "ok" });
    expect(Object.keys(errors).sort()).toEqual(["email", "priceCents"]);
  });
});

const columns: ColumnMeta[] = [
  { name: "age", type: "number", nullable: true, unique: false, primaryKey: false },
  { name: "active", type: "boolean", nullable: true, unique: false, primaryKey: false },
  { name: "bornAt", type: "date", nullable: true, unique: false, primaryKey: false },
];

describe("what an uncoercible value says", () => {
  it("names the column and the type it needs", () => {
    const { fieldErrors } = coerceRowByColumns(
      columns,
      { age: "eleven", active: "maybe", bornAt: "someday" },
      DEFAULT_LABELS,
    );
    expect(fieldErrors).toEqual({
      age: "Age must be a number",
      active: "Active must be yes or no",
      bornAt: "Born at must be a date",
    });
  });

  it("takes each message from the admin's labels", () => {
    const labels = mergeLabels({ form: { invalidNumber: "{label}: give me digits" } });
    const { fieldErrors } = coerceRowByColumns(columns, { age: "eleven" }, labels);
    expect(fieldErrors.age).toBe("Age: give me digits");
  });
});
