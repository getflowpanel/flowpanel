import type { ResourceConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { singularLabel } from "../runtime/resource-title.js";

const withOptions = (options: Record<string, unknown>) =>
  ({ ref: {}, options }) as unknown as ResourceConfig;

describe("singularLabel", () => {
  it("prefers labelOne over the plural label", () => {
    expect(
      singularLabel(withOptions({ label: "Customers", labelOne: "Customer" }), "customers"),
    ).toBe("Customer");
  });

  it("falls back to label when labelOne is absent", () => {
    expect(singularLabel(withOptions({ label: "Customers" }), "customers")).toBe("Customers");
  });

  it("falls back to the raw resource name, as the forms docs specify", () => {
    expect(singularLabel(withOptions({}), "people")).toBe("people");
  });
});
