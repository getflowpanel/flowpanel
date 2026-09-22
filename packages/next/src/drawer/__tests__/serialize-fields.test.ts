import { describe, expect, it } from "vitest";
import { serializeFields } from "../serialize-fields";

const readable = new Set(["id", "email", "plan"]);

describe("serializing a declared drawer field list", () => {
  it("passes the wildcard through untouched", () => {
    expect(serializeFields("*", readable)).toBe("*");
  });

  it("keeps a declared label beside the field name", () => {
    expect(serializeFields([{ name: "email", label: "Work email" }, "plan"], readable)).toEqual([
      { name: "email", label: "Work email" },
      { name: "plan" },
    ]);
  });

  it("drops a field the request may not read, label and all", () => {
    expect(serializeFields([{ name: "secret", label: "Secret" }, "id"], readable)).toEqual([
      { name: "id" },
    ]);
  });

  it("drops an unnamed entry rather than emitting an empty field", () => {
    expect(serializeFields(["" as never], readable)).toEqual([]);
  });
});
