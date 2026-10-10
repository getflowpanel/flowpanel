import { describe, expect, it, vi } from "vitest";
import { resolveAuditLog } from "../../compiler/audit-log";
import type { AuditEvent, AuditLogStore } from "../../types/audit";
import { FlowpanelConfigError } from "../../types/config-error";
import { emitAudit, isAuditActive } from "../audit";

const ev: AuditEvent = { actorId: "u1", action: "users.update", at: new Date() };

function store(): AuditLogStore & { append: ReturnType<typeof vi.fn> } {
  return {
    append: vi.fn(async () => {}),
    list: async () => ({ entries: [], total: 0, capped: false }),
    facets: async () => ({ actors: [], actions: [] }),
  };
}

describe("emitAudit", () => {
  it("hands the event to a configured sink, not the table", async () => {
    const sink = vi.fn();
    const table = store();
    await emitAudit({ audit: { enabled: true, sink }, auditLog: table }, ev);
    expect(sink).toHaveBeenCalledWith(ev);
    expect(table.append).not.toHaveBeenCalled();
  });

  it("writes to the audit table when no sink replaces it", async () => {
    const table = store();
    await emitAudit({ audit: { enabled: true }, auditLog: table }, ev);
    expect(table.append).toHaveBeenCalledWith(ev);
  });

  it("does nothing when audit is off or unset", async () => {
    const sink = vi.fn();
    const table = store();
    await emitAudit({ audit: { enabled: false, sink }, auditLog: table }, ev);
    await emitAudit({ auditLog: table }, ev);
    expect(sink).not.toHaveBeenCalled();
    expect(table.append).not.toHaveBeenCalled();
  });

  it("logs a failed write and never throws, in production or dev", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = process.env.NODE_ENV;
    try {
      for (const env of ["production", "development"]) {
        process.env.NODE_ENV = env;
        const sink = vi.fn().mockRejectedValue(new Error("boom"));
        await expect(emitAudit({ audit: { sink } }, ev)).resolves.toBeUndefined();
        const table = store();
        table.append.mockRejectedValue(new Error("no table"));
        await expect(emitAudit({ audit: {}, auditLog: table }, ev)).resolves.toBeUndefined();
      }
      expect(errSpy).toHaveBeenCalledTimes(4);
      expect(errSpy.mock.calls[0]?.[0]).toMatch(/audit write failed/);
    } finally {
      errSpy.mockRestore();
      process.env.NODE_ENV = original;
    }
  });
});

describe("resolveAuditLog", () => {
  it("uses the adapter's table when audit is on without a sink", () => {
    const table = store();
    expect(resolveAuditLog({ enabled: true }, { auditLog: table })).toBe(table);
    expect(resolveAuditLog({}, { auditLog: table })).toBe(table);
  });

  it("reads nothing back when a sink replaces the table or audit is off", () => {
    const table = store();
    expect(resolveAuditLog({ sink: async () => {} }, { auditLog: table })).toBeNull();
    expect(resolveAuditLog({ enabled: false }, {})).toBeNull();
    expect(resolveAuditLog(undefined, {})).toBeNull();
  });

  it("refuses to start when audit is on, there is no sink and the adapter has no table", () => {
    expect(() => resolveAuditLog({ enabled: true }, {})).toThrow(FlowpanelConfigError);
    expect(() => resolveAuditLog({ enabled: true }, {})).toThrow(/Pass audit\.sink/);
  });
});

describe("isAuditActive", () => {
  const sink = async () => {};
  it("follows the admin's audit and the resource's opt-out", () => {
    expect(isAuditActive({}, undefined)).toBe(false);
    expect(isAuditActive({ audit: {} }, undefined)).toBe(false);
    expect(isAuditActive({ audit: { sink } }, undefined)).toBe(true);
    expect(isAuditActive({ audit: {}, auditLog: store() }, true)).toBe(true);
    expect(isAuditActive({ audit: { sink } }, false)).toBe(false);
    expect(isAuditActive({ audit: { enabled: false, sink } }, true)).toBe(false);
  });
});
