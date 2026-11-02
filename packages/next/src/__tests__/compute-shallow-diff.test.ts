import { describe, expect, it } from "vitest";
import { computeShallowDiff } from "../runtime/action-helpers";

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

  it("treats equal dates and equal JSON in new objects as unchanged", () => {
    const at = "2026-10-09T10:00:00.000Z";
    expect(
      computeShallowDiff(
        { obj: { a: 1 }, at: new Date(at), tags: ["x"] },
        { obj: { a: 1 }, at: new Date(at), tags: ["x"] },
      ),
    ).toBeUndefined();
    expect(computeShallowDiff({ obj: { a: 1 } }, { obj: { a: 2 } })).toEqual({
      before: { obj: { a: 1 } },
      after: { obj: { a: 2 } },
    });
  });
});
