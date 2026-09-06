import { describe, expect, it } from "vitest";
import { DEFAULT_LABELS, mergeLabels, RU_LABELS } from "../../labels";

describe("Russian chrome preset", () => {
  it("is serializable and has every default key and template variable", () => {
    const roundTrip = JSON.parse(JSON.stringify(RU_LABELS));
    expect(roundTrip).toEqual(RU_LABELS);
    for (const [key, value] of Object.entries(DEFAULT_LABELS)) {
      const translation = roundTrip[key];
      if (typeof value === "string") {
        expect(typeof translation).toBe("string");
        expect(translation.match(/\{\w+\}/g) ?? []).toEqual(value.match(/\{\w+\}/g) ?? []);
      } else {
        expect(Object.keys(translation).sort()).toEqual(Object.keys(value).sort());
        for (const [name, text] of Object.entries(value)) {
          expect(typeof translation[name]).toBe("string");
          expect(translation[name].match(/\{\w+\}/g) ?? []).toEqual(text.match(/\{\w+\}/g) ?? []);
        }
      }
    }
  });
  it("uses the same merge contract as custom labels", () => {
    expect(mergeLabels(RU_LABELS)).toEqual(RU_LABELS);
    expect(RU_LABELS.dateRange.locale).toBe("ru-RU");
  });
});
