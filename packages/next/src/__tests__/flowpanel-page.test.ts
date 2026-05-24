import { describe, expect, it } from "vitest";
import { resolveCatchAllSegments } from "../flowpanel-page.js";

describe("resolveCatchAllSegments", () => {
  it("reads `slug` first when present", () => {
    expect(resolveCatchAllSegments({ slug: ["orders"] })).toEqual(["orders"]);
  });

  it("reads `rest` when `slug` is missing", () => {
    expect(resolveCatchAllSegments({ rest: ["orders", "42"] })).toEqual(["orders", "42"]);
  });

  it("prefers `slug` over `rest` if both happen to be present", () => {
    expect(resolveCatchAllSegments({ slug: ["a"], rest: ["b"] })).toEqual(["a"]);
  });

  it("falls back to the first string[] value for arbitrary catch-all names", () => {
    expect(resolveCatchAllSegments({ path: ["users", "u1"] })).toEqual(["users", "u1"]);
  });

  it("returns [] for an empty params object", () => {
    expect(resolveCatchAllSegments({})).toEqual([]);
  });

  it("returns [] when no array param is present", () => {
    // optional catch-all on the root route yields { slug: undefined }
    expect(resolveCatchAllSegments({ slug: undefined })).toEqual([]);
  });

  it("ignores non-array param values when probing", () => {
    expect(resolveCatchAllSegments({ id: "42", rest: ["edit"] })).toEqual(["edit"]);
  });
});
