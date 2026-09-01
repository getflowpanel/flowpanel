import { describe, expect, it } from "vitest";
import { monitors } from "../config/resources/monitors";
import { offers } from "../config/resources/offers";
import { products } from "../config/resources/products";
import { review } from "../config/resources/review";
import { runs } from "../config/resources/runs";

describe("demo resource delete contract", () => {
  it("does not offer hard deletion for runs referenced by historical offers", () => {
    expect(runs.options.delete).toEqual({ disabled: true });
  });

  it.each([
    ["monitors", monitors, ["runs", "offers", "matches", "AI usage"]],
    ["offers", offers, ["matches"]],
    ["products", products, ["matches"]],
  ])("names cascaded dependent data in the %s confirmation", (_name, resource, dependents) => {
    const confirmation = resource.options.delete?.confirm;

    expect(confirmation).toBeTypeOf("string");
    for (const dependent of dependents) expect(confirmation).toContain(dependent);
  });

  it("makes the leaf review hard delete explicit", () => {
    expect(review.options.delete?.disabled).not.toBe(true);
    expect(review.options.delete?.confirm).toContain("review decisions");
  });
});
