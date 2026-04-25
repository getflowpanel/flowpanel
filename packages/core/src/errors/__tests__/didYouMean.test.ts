import { describe, expect, it } from "vitest";
import { didYouMean, levenshtein } from "../didYouMean";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });
  it("returns length when one side is empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
  it("counts a single substitution", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });
  it("counts insertions and deletions", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("didYouMean", () => {
  it("suggests close typos", () => {
    expect(didYouMean("plna", ["plan", "status", "email"])).toEqual(["plan"]);
  });
  it("ignores exact matches", () => {
    expect(didYouMean("plan", ["plan", "status"])).toEqual([]);
  });
  it("returns nothing for totally different strings", () => {
    expect(didYouMean("xyz", ["completelyUnrelated", "alsoDifferent"])).toEqual([]);
  });
  it("caps at 3 candidates, sorted by distance", () => {
    const r = didYouMean("abc", ["abd", "abe", "abf", "abg", "abh"]);
    expect(r).toHaveLength(3);
  });
  it("is case-insensitive", () => {
    expect(didYouMean("Email", ["email", "phone"])).toEqual([]);
    expect(didYouMean("Emial", ["email"])).toEqual(["email"]);
  });
});
