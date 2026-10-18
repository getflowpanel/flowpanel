import { describe, expect, it } from "vitest";
import { DOC_KINDS, validateDocRedirects } from "./docs-contract";

describe("documentation contract", () => {
  it("exposes the five supported page kinds", () => {
    expect(DOC_KINDS).toEqual([
      "tutorial",
      "how-to",
      "explanation",
      "reference",
      "troubleshooting",
    ]);
  });

  it("accepts direct redirects to canonical pages", () => {
    expect(() =>
      validateDocRedirects(
        [{ source: "/docs/old", destination: "/docs/current" }],
        new Set(["/docs/current"]),
      ),
    ).not.toThrow();
  });

  it("rejects a redirect that would hide an existing page", () => {
    expect(() =>
      validateDocRedirects(
        [{ source: "/docs/build", destination: "/docs/current" }],
        new Set(["/docs/build", "/docs/current"]),
      ),
    ).toThrow(/hides a page/i);
  });

  it("rejects redirects whose destination is not canonical", () => {
    expect(() =>
      validateDocRedirects(
        [{ source: "/docs/old", destination: "/docs/missing" }],
        new Set(["/docs/current"]),
      ),
    ).toThrow(/missing destination/i);
  });

  it("rejects redirect chains", () => {
    expect(() =>
      validateDocRedirects(
        [
          { source: "/docs/old", destination: "/docs/middle" },
          { source: "/docs/middle", destination: "/docs/current" },
        ],
        new Set(["/docs/current"]),
      ),
    ).toThrow(/redirect chain/i);
  });

  it("rejects redirect loops", () => {
    expect(() =>
      validateDocRedirects(
        [
          { source: "/docs/one", destination: "/docs/two" },
          { source: "/docs/two", destination: "/docs/one" },
        ],
        new Set<string>(),
      ),
    ).toThrow(/redirect loop/i);
  });
});
