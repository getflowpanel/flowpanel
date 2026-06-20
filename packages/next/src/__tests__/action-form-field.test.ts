import { describe, expect, it } from "vitest";
import { mapActionIssuesToFieldErrors } from "../actions/action-form-field.js";
import {
  serializeActionForm,
  serializeActionFormField,
} from "../actions/serialize-action-field.js";

describe("mapActionIssuesToFieldErrors", () => {
  it("returns null for an empty or undefined issue list", () => {
    expect(mapActionIssuesToFieldErrors(undefined)).toBeNull();
    expect(mapActionIssuesToFieldErrors(null)).toBeNull();
    expect(mapActionIssuesToFieldErrors([])).toBeNull();
  });

  it("keys errors by the first path segment", () => {
    const errors = mapActionIssuesToFieldErrors([
      { path: ["amount"], message: "amount is required" },
      { path: ["email"], message: "must be a valid email" },
    ]);
    expect(errors).toEqual({
      amount: "amount is required",
      email: "must be a valid email",
    });
  });

  it("keys a path-less issue under the empty string (form-level banner)", () => {
    const errors = mapActionIssuesToFieldErrors([{ path: [], message: "input must be an object" }]);
    expect(errors).toEqual({ "": "input must be an object" });
  });

  it("keeps only the first issue per field, mirroring field.errors?.[0]", () => {
    const errors = mapActionIssuesToFieldErrors([
      { path: ["amount"], message: "too small" },
      { path: ["amount"], message: "must be a multiple of 5" },
    ]);
    expect(errors).toEqual({ amount: "too small" });
  });

  it("stringifies non-string leading path segments", () => {
    const errors = mapActionIssuesToFieldErrors([{ path: [0], message: "required" }]);
    expect(errors).toEqual({ "0": "required" });
  });
});

describe("serializeActionFormField", () => {
  it("projects a FieldDef onto the wire-safe ActionFormField shape", () => {
    const wire = serializeActionFormField({
      name: "amount",
      label: "Amount",
      help: "In cents",
      placeholder: "0",
      type: "number",
      required: true,
    });
    expect(wire).toEqual({
      name: "amount",
      label: "Amount",
      help: "In cents",
      placeholder: "0",
      type: "number",
      required: true,
    });
  });

  it("drops non-serializable members (validate, defaultValue)", () => {
    const wire = serializeActionFormField({
      name: "reason",
      required: true,
      validate: () => null,
      defaultValue: "n/a",
    });
    expect(wire).toEqual({ name: "reason", required: true });
    expect("validate" in wire).toBe(false);
    expect("defaultValue" in wire).toBe(false);
  });

  it("normalizes string[] options shorthand to {label, value} pairs", () => {
    const wire = serializeActionFormField({
      name: "status",
      type: "select",
      options: ["open", "closed"],
    });
    expect(wire.options).toEqual([
      { label: "open", value: "open" },
      { label: "closed", value: "closed" },
    ]);
  });

  it("passes through {label, value} options verbatim (value stringified)", () => {
    const wire = serializeActionFormField({
      name: "priority",
      type: "select",
      options: [{ label: "High", value: 1 }],
    });
    expect(wire.options).toEqual([{ label: "High", value: "1" }]);
  });
});

describe("serializeActionForm", () => {
  it("returns undefined for an empty or undefined form", () => {
    expect(serializeActionForm(undefined)).toBeUndefined();
    expect(serializeActionForm([])).toBeUndefined();
  });

  it("serializes every field in order", () => {
    const wire = serializeActionForm([
      { name: "a", type: "text" },
      { name: "b", type: "number", required: true },
    ]);
    expect(wire).toEqual([
      { name: "a", type: "text" },
      { name: "b", type: "number", required: true },
    ]);
  });
});
