import { describe, expect, it } from "vitest";
import { FlowpanelAccessError } from "../../types/error.js";
import { checkRequireRole } from "../auth.js";

describe("checkRequireRole", () => {
  it("passes when role matches string", () => {
    expect(() => checkRequireRole("admin", "admin", null)).not.toThrow();
  });
  it("passes when role matches any of array", () => {
    expect(() => checkRequireRole(["admin", "owner"], "owner", null)).not.toThrow();
  });
  it("throws access error on mismatch (string)", () => {
    expect(() => checkRequireRole("admin", "guest", null)).toThrow(FlowpanelAccessError);
  });
  it("throws access error on mismatch (array)", () => {
    expect(() => checkRequireRole(["admin", "owner"], "guest", null)).toThrow(FlowpanelAccessError);
  });
  it("honors predicate — allow", () => {
    expect(() => checkRequireRole((s: any) => s?.ok === true, "x", { ok: true })).not.toThrow();
  });
  it("honors predicate — deny", () => {
    expect(() => checkRequireRole((s: any) => s?.ok === true, "x", { ok: false })).toThrow(
      FlowpanelAccessError,
    );
  });
  it("no-op when undefined", () => {
    expect(() => checkRequireRole(undefined, "guest", null)).not.toThrow();
  });
});
