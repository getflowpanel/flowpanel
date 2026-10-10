import { formatPercentValue, resolveFormatting } from "@flowpanel/core/format";
import { describe, expect, it } from "vitest";
import { type DeltaPrint, describeDelta } from "../delta";

function printIn(locale: string): DeltaPrint {
  const formatting = resolveFormatting({ locale });
  const onePlace = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return {
    value: (n) => String(n),
    percent: (fraction) => formatPercentValue(fraction, formatting, 1),
    points: (n) => `${onePlace.format(n)} pp`,
  };
}

const en = printIn("en-US");

describe("describeDelta", () => {
  it("shows a signed percentage and whether it is good news", () => {
    expect(describeDelta({ value: 0.123 }, 112, undefined, en)).toEqual({
      text: "+12.3%",
      mood: "good",
      material: true,
    });
    expect(describeDelta({ value: 0.2, goodWhen: "down" }, 60, undefined, en)).toEqual({
      text: "+20%",
      mood: "bad",
      material: true,
    });
    expect(describeDelta({ value: -0.2 }, 60, undefined, en).text).toBe("−20%");
  });

  it("calls a change under 5% immaterial, so the card leaves it uncoloured", () => {
    expect(describeDelta({ value: 0.03 }, 103, undefined, en)).toEqual({
      text: "+3%",
      mood: "good",
      material: false,
    });
  });

  it("prints the percentage in the admin's locale", () => {
    expect(describeDelta({ value: 0.123 }, 112, undefined, printIn("ru-RU")).text).toMatch(
      /^\+12,3\s%$/,
    );
  });

  it("keeps a change inside ±1% neutral and unsigned", () => {
    expect(describeDelta({ value: 0.004 }, 251, undefined, en)).toEqual({
      text: "0.4%",
      mood: "flat",
      material: false,
    });
  });

  it("shows the absolute change of a count when the base is under 20", () => {
    expect(describeDelta({ value: 1.5, previous: 2 }, 5, undefined, en)).toEqual({
      text: "+3",
      mood: "good",
      material: true,
    });
    expect(describeDelta({ value: -0.5, previous: 4 }, 2, "number", en)).toEqual({
      text: "−2",
      mood: "bad",
      material: true,
    });
    expect(describeDelta({ value: 0, previous: 0 }, 0, undefined, en)).toEqual({
      text: "0",
      mood: "flat",
      material: false,
    });
  });

  it("keeps the percentage for a base of 20 or more, a fractional base, money or text", () => {
    expect(describeDelta({ value: 0.5, previous: 20 }, 30, undefined, en).text).toBe("+50%");
    expect(describeDelta({ value: 0.5, previous: 2.5 }, 3.75, undefined, en).text).toBe("+50%");
    expect(describeDelta({ value: 1.5, previous: 2 }, 5, "currency", en).text).toBe("+150%");
    expect(describeDelta({ value: 0.5, previous: 2 }, "3 ₽", undefined, en).text).toBe("+50%");
  });

  it("reads a rate's change in percentage points, and a tiny one as flat", () => {
    expect(describeDelta({ value: 0.075, previous: 0.4 }, 0.43, "percent", en)).toEqual({
      text: "+3 pp",
      mood: "good",
      material: true,
    });
    expect(describeDelta({ value: 0.00095, previous: 0.4196 }, 0.42, "percent", en)).toEqual({
      text: "0 pp",
      mood: "flat",
      material: false,
    });
  });

  it("never colours a neutral metric", () => {
    expect(describeDelta({ value: 0.4, goodWhen: "neutral" }, 140, undefined, en).mood).toBe(
      "flat",
    );
  });
});
