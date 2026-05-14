import { describe, expect, it } from "vitest";
import { hasMarker, MARKER_REGEX, stampMarker } from "../marker.js";

describe("eject marker helpers", () => {
  it("stampMarker prepends the marker line", () => {
    const out = stampMarker("export const x = 1;\n", "1.0.0-beta.0");
    expect(out.split("\n")[0]).toBe("// flowpanel: ejected @ 1.0.0-beta.0 — this file is yours");
    expect(out).toContain("export const x = 1;");
  });

  it("hasMarker matches stamped sources across version shapes", () => {
    expect(hasMarker("// flowpanel: ejected @ 1.0.0 — this file is yours\nfoo")).toBe(true);
    expect(hasMarker("// flowpanel: ejected @ 1.0.0-beta.0 — this file is yours\nfoo")).toBe(true);
    expect(
      hasMarker("// flowpanel: ejected @ 2.5.0+exp.sha.5114f85 — this file is yours\nfoo"),
    ).toBe(true);
    expect(hasMarker("// flowpanel: ejected @ 1.0.0")).toBe(false); // missing tail
    expect(hasMarker("foo")).toBe(false);
  });

  it("MARKER_REGEX is exported and reusable", () => {
    expect(MARKER_REGEX).toBeInstanceOf(RegExp);
    expect(MARKER_REGEX.test("// flowpanel: ejected @ 1.0.0 — this file is yours")).toBe(true);
  });
});
