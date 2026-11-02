import { describe, expect, it } from "vitest";
import { marketplaceLabel } from "../marketplaces";
import { MARKETPLACES } from "../types";

describe("marketplaceLabel", () => {
  it("spells each marketplace the way the store does", () => {
    expect(marketplaceLabel("best_buy")).toBe("Best Buy");
    expect(marketplaceLabel("ebay")).toBe("eBay");
    expect(marketplaceLabel("media_markt")).toBe("MediaMarkt");
    expect(marketplaceLabel("mercado_libre")).toBe("Mercado Libre");
  });

  it("labels every known marketplace", () => {
    for (const marketplace of MARKETPLACES) {
      expect(marketplaceLabel(marketplace)).not.toContain("_");
    }
  });

  it("passes an unknown value through", () => {
    expect(marketplaceLabel("etsy")).toBe("etsy");
  });
});
