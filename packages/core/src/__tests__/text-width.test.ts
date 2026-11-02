import { describe, expect, it } from "vitest";
import { textWidthEm } from "../text-width";

describe("one glyph table for every estimate", () => {
  it("counts wide Cyrillic as wide as W, and other capitals wider than lowercase", () => {
    expect(textWidthEm("Щ")).toBe(textWidthEm("W"));
    expect(textWidthEm("Ж")).toBeGreaterThan(textWidthEm("Д"));
    expect(textWidthEm("Д")).toBeGreaterThan(textWidthEm("д"));
  });

  it("counts an emoji sequence once, wider than a letter, and CJK a full em", () => {
    expect(textWidthEm("👨‍👩‍👧")).toBe(1.3);
    expect(textWidthEm("⭐ Rating")).toBeGreaterThan(textWidthEm("* Rating") + 0.7);
    expect(textWidthEm("状態")).toBe(2.1);
  });
});
