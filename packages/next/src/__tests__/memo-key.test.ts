import { describe, expect, it } from "vitest";
import { callKey, countKey } from "../runtime/memo-key";

describe("callKey", () => {
  const load = async (..._args: unknown[]) => 1;

  it("matches the same function with equal primitive and date arguments", () => {
    expect(callKey(load, ["u1", 10, true, new Date(5)])).toBe(
      callKey(load, ["u1", 10, true, new Date(5)]),
    );
  });

  it("tells apart another function, other arguments and another object", () => {
    const other = async () => 1;
    const shared = {};
    expect(callKey(load, ["u1"])).not.toBe(callKey(other, ["u1"]));
    expect(callKey(load, ["u1"])).not.toBe(callKey(load, ["u2"]));
    expect(callKey(load, [1])).not.toBe(callKey(load, ["1"]));
    expect(callKey(load, [{}])).not.toBe(callKey(load, [{}]));
    expect(callKey(load, [shared])).toBe(callKey(load, [shared]));
  });

  it("keeps a string that looks like two arguments apart from the two", () => {
    expect(callKey(load, ["a|string:b"])).not.toBe(callKey(load, ["a", "b"]));
  });
});

describe("countKey", () => {
  it("ignores the order a where was written in", () => {
    expect(countKey("orders", { a: 1, b: "x" })).toBe(countKey("orders", { b: "x", a: 1 }));
  });

  it("tells apart resources, value types, dates, and treats no where as an empty one", () => {
    expect(countKey("orders", { a: 1 })).not.toBe(countKey("users", { a: 1 }));
    expect(countKey("orders", { a: 1 })).not.toBe(countKey("orders", { a: "1" }));
    expect(countKey("orders", { at: new Date(1) })).not.toBe(
      countKey("orders", { at: new Date(2) }),
    );
    expect(countKey("orders", undefined)).toBe(countKey("orders", {}));
  });

  it("tells apart a count over another range field or other bounds", () => {
    const a = { from: new Date(1), to: new Date(2) };
    const b = { from: new Date(1), to: new Date(3) };
    expect(countKey("orders", {}, { field: "at", ...a })).not.toBe(countKey("orders", {}));
    expect(countKey("orders", {}, { field: "at", ...a })).not.toBe(
      countKey("orders", {}, { field: "at", ...b }),
    );
    expect(countKey("orders", {}, { field: "at", ...a })).not.toBe(
      countKey("orders", {}, { field: "createdAt", ...a }),
    );
  });
});
