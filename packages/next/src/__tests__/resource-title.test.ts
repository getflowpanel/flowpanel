import type { ResourceConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import {
  humanizeSingular,
  labelInSentence,
  singularLabel,
  singularTitle,
} from "../runtime/resource-title";

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

  it("falls back to the resource name made singular and readable", () => {
    expect(singularLabel(withOptions({}), "users")).toBe("User");
    expect(singularLabel(withOptions({}), "order_items")).toBe("Order item");
  });
});

describe("humanizeSingular", () => {
  it("makes the last word singular", () => {
    const cases: [string, string][] = [
      ["users", "User"],
      ["order_items", "Order item"],
      ["orderItems", "Order item"],
      ["categories", "Category"],
      ["addresses", "Address"],
      ["boxes", "Box"],
      ["batches", "Batch"],
      ["statuses", "Status"],
      ["houses", "House"],
      ["keys", "Key"],
      ["people", "Person"],
      ["api_keys", "API key"],
    ];
    for (const [name, label] of cases) expect(humanizeSingular(name)).toBe(label);
  });

  it("keeps a name that is already singular or the same in both", () => {
    for (const name of ["User", "status", "address", "analysis", "news", "data", "series"]) {
      expect(humanizeSingular(name).toLowerCase()).toBe(name.toLowerCase());
    }
  });
});

describe("singularTitle", () => {
  it("puts the label mid-sentence after a word and as written elsewhere", () => {
    const users = withOptions({});
    expect(singularTitle("New {label}", users, "users")).toBe("New user");
    expect(singularTitle("Edit {label}", withOptions({ labelOne: "API key" }), "keys")).toBe(
      "Edit API key",
    );
    expect(singularTitle("{label} bearbeiten", users, "users")).toBe("User bearbeiten");
    expect(singularTitle("Новая запись: {label}", withOptions({ labelOne: "Клиент" }), "c")).toBe(
      "Новая запись: Клиент",
    );
  });
});

describe("labelInSentence", () => {
  it("lowercases a capitalised word so it reads inside a sentence", () => {
    expect(labelInSentence("Customers")).toBe("customers");
    expect(labelInSentence("Team members")).toBe("team members");
  });

  it("keeps acronyms and already lowercase names as written", () => {
    expect(labelInSentence("API keys")).toBe("API keys");
    expect(labelInSentence("SKUs")).toBe("SKUs");
    expect(labelInSentence("people")).toBe("people");
  });
});
