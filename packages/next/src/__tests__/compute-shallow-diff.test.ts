import { describe, expect, it } from "vitest";
import { computeShallowDiff, isAuditActive } from "../runtime/action-helpers.js";

describe("computeShallowDiff", () => {
  it("returns undefined when both snapshots are null", () => {
    expect(computeShallowDiff(null, null)).toBeUndefined();
  });

  it("treats a null `before` as a create", () => {
    expect(computeShallowDiff(null, { id: "1", name: "a" })).toEqual({
      before: null,
      after: { id: "1", name: "a" },
    });
  });

  it("treats a null `after` as a delete", () => {
    expect(computeShallowDiff({ id: "1", name: "a" }, null)).toEqual({
      before: { id: "1", name: "a" },
      after: null,
    });
  });

  it("keeps only changed keys", () => {
    const before = { id: "1", name: "old", status: "active" };
    const after = { id: "1", name: "new", status: "active" };
    expect(computeShallowDiff(before, after)).toEqual({
      before: { name: "old" },
      after: { name: "new" },
    });
  });

  it("returns undefined when nothing changed (side-effect-only action)", () => {
    const row = { id: "1", name: "a", n: 3 };
    expect(computeShallowDiff(row, { ...row })).toBeUndefined();
  });

  it("captures keys added or removed between snapshots", () => {
    expect(computeShallowDiff({ id: "1" }, { id: "1", extra: true })).toEqual({
      before: { extra: undefined },
      after: { extra: true },
    });
  });

  it("compares with Object.is (NaN equal to NaN, no false positive)", () => {
    const before = { v: Number.NaN };
    const after = { v: Number.NaN };
    expect(computeShallowDiff(before, after)).toBeUndefined();
  });

  it("does not deep-compare nested references", () => {
    const nested = { a: 1 };
    // Same reference → not flagged (documented shallow behaviour).
    expect(computeShallowDiff({ obj: nested }, { obj: nested })).toBeUndefined();
    // Different reference, equal contents → flagged.
    const diff = computeShallowDiff({ obj: { a: 1 } }, { obj: { a: 1 } });
    expect(diff).toBeDefined();
  });
});

describe("isAuditActive", () => {
  const sink = async () => undefined;

  it("false when no audit config", () => {
    expect(isAuditActive(undefined, undefined)).toBe(false);
  });

  it("false when audit config has no sink", () => {
    expect(isAuditActive({}, undefined)).toBe(false);
  });

  it("true when a sink is configured and resource didn't opt out", () => {
    expect(isAuditActive({ sink }, undefined)).toBe(true);
    expect(isAuditActive({ sink }, true)).toBe(true);
  });

  it("false when the resource opted out via audit:false", () => {
    expect(isAuditActive({ sink }, false)).toBe(false);
  });
});
