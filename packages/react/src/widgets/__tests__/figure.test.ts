import { describe, expect, it } from "vitest";
import { figureSize } from "../figure";

describe("a KPI figure's size", () => {
  it("stays 2rem unless its characters would not fit the card", () => {
    expect(figureSize("$142,594")?.fontSize).toBe("min(2rem, 20.83cqi)");
    expect(figureSize(12)?.fontSize).toBe("min(2rem, 83.33cqi)");
  });

  it("leaves a rendered figure alone", () => {
    expect(figureSize(null)).toBeUndefined();
  });
});
