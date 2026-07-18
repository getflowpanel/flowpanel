import { describe, expect, it, vi } from "vitest";
import type { AuditEvent } from "../../types/config.js";
import { emitAudit } from "../audit.js";

const ev: AuditEvent = { actorId: "u1", action: "users.update", at: new Date() };

describe("emitAudit", () => {
  it("calls configured sink", async () => {
    const sink = vi.fn();
    await emitAudit({ enabled: true, sink }, ev);
    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith(ev);
  });

  it("no-op when enabled is false", async () => {
    const sink = vi.fn();
    await emitAudit({ enabled: false, sink }, ev);
    expect(sink).not.toHaveBeenCalled();
  });

  it("no-op when config undefined", async () => {
    await expect(emitAudit(undefined, ev)).resolves.toBeUndefined();
  });

  it("no-op when no sink configured", async () => {
    await expect(emitAudit({ enabled: true }, ev)).resolves.toBeUndefined();
  });

  it("never throws when the sink rejects, in production or dev", async () => {
    for (const env of ["production", "development"]) {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = env;
      try {
        const sink = vi.fn().mockRejectedValue(new Error("boom"));
        await expect(emitAudit({ enabled: true, sink }, ev)).resolves.toBeUndefined();
        expect(sink).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = original;
      }
    }
  });

  it("reports sink errors even in production — a hole in the audit trail must be visible", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const sink = vi.fn().mockRejectedValue(new Error("boom"));
      await expect(emitAudit({ enabled: true, sink }, ev)).resolves.toBeUndefined();
      expect(errSpy).toHaveBeenCalled();
      // Confirm the formatted message reaches console.error verbatim.
      expect(errSpy.mock.calls[0]?.[0]).toMatch(/audit sink error/);
    } finally {
      errSpy.mockRestore();
      process.env.NODE_ENV = original;
    }
  });
});
