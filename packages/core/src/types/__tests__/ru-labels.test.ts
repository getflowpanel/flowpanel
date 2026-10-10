import { describe, expect, it } from "vitest";
import { DEFAULT_LABELS, mergeLabels, RU_LABELS } from "../../labels";

const variables = (text: string): string[] => text.match(/\{\w+\}/g) ?? [];

const PLURAL_FORMS = new Set(["zero", "one", "two", "few", "many", "other"]);
const isPluralLabel = (value: Record<string, unknown>): boolean =>
  "other" in value && Object.keys(value).every((key) => PLURAL_FORMS.has(key));

function expectSameShape(english: unknown, russian: unknown): void {
  if (typeof english === "string") {
    expect(typeof russian).toBe("string");
    expect(variables(russian as string)).toEqual(variables(english));
    return;
  }
  const group = english as Record<string, unknown>;
  const translated = russian as Record<string, unknown>;
  if (isPluralLabel(group)) {
    // A plural takes the categories its language has: English one/other, Russian one/few/many/other.
    expect(isPluralLabel(translated)).toBe(true);
    for (const form of Object.values(translated)) {
      expect(variables(form as string)).toEqual(variables(group.other as string));
    }
    return;
  }
  expect(Object.keys(translated).sort()).toEqual(Object.keys(group).sort());
  for (const [key, value] of Object.entries(group)) expectSameShape(value, translated[key]);
}

describe("Russian chrome preset", () => {
  it("is serializable and has every default key and template variable", () => {
    const roundTrip = JSON.parse(JSON.stringify(RU_LABELS));
    expect(roundTrip).toEqual(RU_LABELS);
    for (const [key, value] of Object.entries(DEFAULT_LABELS)) {
      expectSameShape(value, roundTrip[key]);
    }
  });
  it("uses the same merge contract as custom labels", () => {
    expect(mergeLabels(RU_LABELS)).toEqual(RU_LABELS);
    expect(RU_LABELS.dateRange.locale).toBe("ru-RU");
  });
});
