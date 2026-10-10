import { describe, expect, it } from "vitest";
import { listings } from "../config/resources/listings";
import { matches } from "../config/resources/matches";
import { monitors } from "../config/resources/monitors";
import { products } from "../config/resources/products";
import { runs } from "../config/resources/runs";

describe("demo resource delete contract", () => {
  it("does not offer hard deletion for runs referenced by historical listings", () => {
    expect(runs.options.delete).toEqual({ disabled: true });
  });

  it.each([
    ["monitors", monitors, ["runs", "listings", "matches", "AI usage"]],
    ["listings", listings, ["matches"]],
    ["products", products, ["matches"]],
  ])(
    "names cascaded dependent data in the %s confirmation, for one and many",
    (_name, resource, dependents) => {
      const confirmation = resource.options.delete?.confirm;

      expect(confirmation).toBeTypeOf("object");
      if (typeof confirmation !== "object") return;
      for (const text of [confirmation.one, confirmation.other]) {
        for (const dependent of dependents) expect(text).toContain(dependent);
      }
      expect(confirmation.other).toContain("{n}");
    },
  );

  it("makes the leaf review hard delete explicit", () => {
    const confirmation = matches.options.delete?.confirm;
    expect(matches.options.delete?.disabled).not.toBe(true);
    expect(typeof confirmation === "object" ? confirmation.one : confirmation).toContain(
      "review decision",
    );
  });
});
