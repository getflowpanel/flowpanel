import { describe, expect, it } from "vitest";
import { figureSize } from "../figure";

describe("a KPI figure's size", () => {
  it("stays 2rem unless its characters would not fit the card", () => {
    expect(figureSize("$142,594")).toEqual({ "data-fp-figure": "8" });
    expect(figureSize(12)).toEqual({ "data-fp-figure": "2" });
    expect(figureSize("x".repeat(60))).toEqual({ "data-fp-figure": "40" });
  });

  it("leaves a rendered figure alone", () => {
    expect(figureSize(null)).toEqual({});
  });
});
