import { describe, expect, it } from "vitest";
import { marketplaceLabel } from "../marketplaces";
import { MARKETPLACES } from "../types";

describe("marketplaceLabel", () => {
  it("capitalises each word of a snake_case marketplace", () => {
    expect(marketplaceLabel("best_buy")).toBe("Best Buy");
    expect(marketplaceLabel("mercado_libre")).toBe("Mercado Libre");
  });

  it("capitalises a single word", () => {
    expect(marketplaceLabel("amazon")).toBe("Amazon");
  });

  it("leaves no underscore in any known marketplace", () => {
    for (const marketplace of MARKETPLACES) {
      expect(marketplaceLabel(marketplace)).not.toContain("_");
    }
  });
});
