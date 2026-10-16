import { describe, expect, it } from "vitest";
import { humanize, humanizeAmount, humanizeReference } from "../humanize";

describe("humanize keeps what a name abbreviates", () => {
  it("writes initialisms in capitals, alone, inside a name and in the plural", () => {
    expect(["id", "sku", "url", "orderId", "mrr", "vatNumber", "aiModel"].map(humanize)).toEqual([
      "ID",
      "SKU",
      "URL",
      "Order ID",
      "MRR",
      "VAT number",
      "AI model",
    ]);
    expect(["tagIds", "imageUrls", "skus"].map(humanize)).toEqual([
      "Tag IDs",
      "Image URLs",
      "SKUs",
    ]);
  });

  it("puts a trailing unit in parentheses", () => {
    expect(
      ["durationMs", "duration_ms", "sizeKb", "timeoutSec", "priceUsd", "growthPct"].map(humanize),
    ).toEqual([
      "Duration (ms)",
      "Duration (ms)",
      "Size (KB)",
      "Timeout (s)",
      "Price (USD)",
      "Growth (%)",
    ]);
    expect(humanize("amountCents")).toBe("Amount (cents)");
  });

  it("keeps ms in lower case inside a name, so it never reads as the title Ms", () => {
    expect(humanize("msCount")).toBe("ms count");
    expect(humanize("pingMsP95")).toBe("Ping ms p95");
  });

  it("leaves words that only look like units alone", () => {
    expect(["msgCount", "status", "address"].map(humanize)).toEqual([
      "Msg count",
      "Status",
      "Address",
    ]);
  });

  it("drops a reference's key and a money field's minor-unit suffix", () => {
    expect(humanizeReference("customer_id")).toBe("Customer");
    expect(humanizeReference("parentSkuId")).toBe("Parent SKU");
    expect(humanizeAmount("amount_cents")).toBe("Amount");
    expect(humanizeAmount("totalPriceMinor")).toBe("Total price");
    expect(humanizeAmount("cents")).toBe("Cents");
  });
});
