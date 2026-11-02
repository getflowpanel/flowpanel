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
    expect(singularTitle("New {label}", users, "users", "en-US")).toBe("New user");
    expect(
      singularTitle("Edit {label}", withOptions({ labelOne: "API key" }), "keys", "en-US"),
    ).toBe("Edit API key");
    expect(singularTitle("{label} bearbeiten", users, "users", "de-DE")).toBe("User bearbeiten");
    expect(
      singularTitle("Новая запись: {label}", withOptions({ labelOne: "Клиент" }), "c", "ru-RU"),
    ).toBe("Новая запись: Клиент");
  });
});

describe("labelInSentence", () => {
  it("lowercases a capitalised word so it reads inside a sentence", () => {
    expect(labelInSentence("Customers", "en-US")).toBe("customers");
    expect(labelInSentence("Team members", "en-US")).toBe("team members");
  });

  it("keeps a German noun's capital, as German writes every noun", () => {
    expect(labelInSentence("Rechnungen", "de-DE")).toBe("Rechnungen");
    expect(singularTitle("Keine {label}", withOptions({ labelOne: "Rechnung" }), "r", "de")).toBe(
      "Keine Rechnung",
    );
    expect(labelInSentence("Factures", "fr-FR")).toBe("factures");
  });

  it("keeps acronyms and already lowercase names as written", () => {
    expect(labelInSentence("API keys", "en-US")).toBe("API keys");
    expect(labelInSentence("SKUs", "en-US")).toBe("SKUs");
    expect(labelInSentence("people", "en-US")).toBe("people");
  });
});
