import { describe, expect, it } from "vitest";
import {
  AUDIT_STORED_PREVIEW,
  AUDIT_VALUE_PREVIEW,
  auditDiffPreview,
  storedAuditPreview,
} from "../audit-preview";

describe("auditDiffPreview", () => {
  it("cuts each long value to its start and keeps short ones whole", () => {
    const long = "word ".repeat(200_000);
    const data = { rows: Array.from({ length: 200 }, (_, i) => ({ i })) };
    const preview = auditDiffPreview({
      before: { name: "Ann", notes: null },
      after: { name: "Ann", notes: long, data },
    });
    expect(preview?.before).toEqual({ name: "Ann", notes: null });
    const after = preview?.after as Record<string, unknown>;
    expect(after.name).toBe("Ann");
    expect(storedAuditPreview(after.notes)).toEqual({
      text: long.slice(0, AUDIT_VALUE_PREVIEW),
      length: long.length,
    });
    expect(storedAuditPreview(after.data)?.length).toBe(JSON.stringify(data, null, 2).length);
    expect(JSON.stringify(preview).length).toBeLessThan(3 * AUDIT_VALUE_PREVIEW);
  });

  it("keeps one event's preview within its budget however wide the row", () => {
    const after = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`text${i}`, "y".repeat(5_000)]),
    );
    const stored = (auditDiffPreview({ before: null, after })?.after ?? {}) as Record<
      string,
      unknown
    >;
    const kept = Object.values(stored).map((value) => storedAuditPreview(value)?.text.length ?? 0);
    expect(kept.reduce((sum, n) => sum + n, 0)).toBe(AUDIT_STORED_PREVIEW);
    expect(storedAuditPreview(stored.text59)).toEqual({
      text: "",
      length: 5_000,
    });
  });

  it("cuts a side that is not a record, such as a long string or array from a host route", () => {
    const list = Array.from({ length: 10_000 }, (_, i) => i);
    const preview = auditDiffPreview({ before: null, after: list });
    expect(storedAuditPreview(preview?.after)?.text).toHaveLength(AUDIT_VALUE_PREVIEW);
    expect(JSON.stringify(preview).length).toBeLessThan(2 * AUDIT_VALUE_PREVIEW);
  });

  it("leaves a missing diff and a null side alone", () => {
    expect(auditDiffPreview(undefined)).toBeUndefined();
    expect(auditDiffPreview({ before: null, after: { a: 1 } })).toEqual({
      before: null,
      after: { a: 1 },
    });
  });

  it("reads a value stored whole as no preview", () => {
    expect(storedAuditPreview({ text: "a", length: 1 })).toBeNull();
    expect(storedAuditPreview("plain")).toBeNull();
  });
});
