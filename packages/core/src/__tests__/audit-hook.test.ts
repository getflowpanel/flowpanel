import { describe, expect, it, vi } from "vitest";
import type { AuditEvent } from "../config/auditEvent";
import { createAuditLogMiddleware } from "../trpc/middleware/auditLog";

/**
 * These tests directly invoke the middleware factory with a minimal mock
 * of the tRPC builder. We avoid spinning up a real initTRPC instance —
 * the middleware's contract is "given ({ctx, next, path}) call audit hook
 * on mutations"; we can verify that without the transport.
 */

type MiddlewareFn = (opts: {
  ctx: unknown;
  path: string;
  next: () => Promise<{ ok: boolean; error?: unknown }>;
}) => Promise<unknown>;

function makeMockBuilder(): { middleware: (fn: MiddlewareFn) => MiddlewareFn } {
  return { middleware: (fn) => fn };
}

function makeCtx(audit?: (e: AuditEvent) => void | Promise<void>): unknown {
  return {
    config: audit ? { audit } : {},
    session: { userId: "u1", role: "admin", email: "u1@example.com" },
    db: { execute: vi.fn().mockResolvedValue(undefined) },
    req: {
      headers: {
        get: (k: string) =>
          ({ "x-forwarded-for": "1.2.3.4", "user-agent": "ua", "x-request-id": "rid" })[k] ?? null,
      },
    },
  };
}

describe("audit hook", () => {
  it("fires config.audit after a successful mutation", async () => {
    const audit = vi.fn();
    const mw = createAuditLogMiddleware(makeMockBuilder()) as MiddlewareFn;
    await mw({
      ctx: makeCtx(audit),
      path: "resource.userMutation",
      next: async () => ({ ok: true }),
    });
    expect(audit).toHaveBeenCalledTimes(1);
    const event = audit.mock.calls[0]?.[0] as AuditEvent;
    expect(event.path).toBe("resource.userMutation");
    expect(event.kind).toBe("mutation");
    expect(event.ok).toBe(true);
    expect(event.actor).toMatchObject({ id: "u1", role: "admin", email: "u1@example.com" });
    expect(event.ip).toBe("1.2.3.4");
    expect(event.userAgent).toBe("ua");
    expect(event.requestId).toBe("rid");
    expect(event.at).toBeInstanceOf(Date);
  });

  it("reports ok=false + error when the procedure failed", async () => {
    const audit = vi.fn();
    const mw = createAuditLogMiddleware(makeMockBuilder()) as MiddlewareFn;
    await mw({
      ctx: makeCtx(audit),
      path: "resource.userMutation",
      next: async () => ({ ok: false, error: new Error("boom") }),
    });
    const event = audit.mock.calls[0]?.[0] as AuditEvent;
    expect(event.ok).toBe(false);
    expect(event.error).toContain("boom");
  });

  it("does NOT fire on query-style paths (metrics/runs.list/stages/etc)", async () => {
    const audit = vi.fn();
    const mw = createAuditLogMiddleware(makeMockBuilder()) as MiddlewareFn;
    for (const path of ["metrics.getAll", "runs.list", "stages.info", "users.list"]) {
      await mw({ ctx: makeCtx(audit), path, next: async () => ({ ok: true }) });
    }
    expect(audit).not.toHaveBeenCalled();
  });

  it("swallows exceptions thrown by the audit callback", async () => {
    const audit = vi.fn(() => {
      throw new Error("audit sink is down");
    });
    const mw = createAuditLogMiddleware(makeMockBuilder()) as MiddlewareFn;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = (await mw({
        ctx: makeCtx(audit),
        path: "resource.userMutation",
        next: async () => ({ ok: true }),
      })) as { ok: boolean };
      expect(result.ok).toBe(true); // response unaffected
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining("config.audit threw"),
        expect.any(Error),
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it("still fires when session is absent (mutation without auth)", async () => {
    const audit = vi.fn();
    const ctx = makeCtx(audit) as { session: null };
    ctx.session = null;
    const mw = createAuditLogMiddleware(makeMockBuilder()) as MiddlewareFn;
    await mw({ ctx, path: "resource.userMutation", next: async () => ({ ok: true }) });
    const event = audit.mock.calls[0]?.[0] as AuditEvent;
    expect(event.actor).toBeNull();
  });
});
