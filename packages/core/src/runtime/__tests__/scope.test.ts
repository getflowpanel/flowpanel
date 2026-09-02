import { describe, expect, it } from "vitest";
import { FlowpanelAccessError } from "../../types/error";
import { assertResourceScope } from "../scope";

describe("assertResourceScope", () => {
  it("passes when global scope defined and resource has scope fn", () => {
    expect(() => assertResourceScope({ hasGlobal: true, resourceScope: () => ({}) })).not.toThrow();
  });
  it("passes when resource opts into bypass", () => {
    expect(() => assertResourceScope({ hasGlobal: true, resourceScope: "bypass" })).not.toThrow();
  });
  it("throws when global scope active but resource scope missing", () => {
    expect(() => assertResourceScope({ hasGlobal: true, resourceScope: undefined })).toThrow(
      FlowpanelAccessError,
    );
  });
  it("passes when no global scope (resource scope irrelevant)", () => {
    expect(() => assertResourceScope({ hasGlobal: false, resourceScope: undefined })).not.toThrow();
  });
});
