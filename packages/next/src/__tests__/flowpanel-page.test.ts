import { describe, expect, it } from "vitest";
import { resolveCatchAllSegments } from "../flowpanel-page";
import { decodeAtom, encodeAtom } from "../runtime/href";

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

describe("page catch-all segments", () => {
  it("decodes exactly once, so an identifier arrives as itself", () => {
    // Next hands page params over still encoded; the API catch-all does not.
    const decoded = resolveCatchAllSegments({ slug: ["order", "a%2Fb"] }).map(decodeAtom);
    expect(decoded).toEqual(["order", "a/b"]);
    expect(decoded.map(decodeAtom)).toEqual(["order", "a/b"]);
  });

  it("keeps a literal percent sign addressable rather than throwing", () => {
    expect(resolveCatchAllSegments({ slug: ["order", "100%25"] }).map(decodeAtom)).toEqual([
      "order",
      "100%",
    ]);
    expect(resolveCatchAllSegments({ slug: ["order", "100%"] }).map(decodeAtom)).toEqual([
      "order",
      "100%",
    ]);
  });

  it("re-encodes to the URL the browser asked for", () => {
    const slug = resolveCatchAllSegments({ slug: ["order", "caf%C3%A9"] }).map(decodeAtom);
    expect(`/${slug.map(encodeAtom).join("/")}`).toBe("/order/caf%C3%A9");
  });
});
