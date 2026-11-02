import { defineAdmin } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { actorIdFromSession, buildAuditEvent } from "../runtime/action-helpers";
import { adapter } from "./detail-fixture";

describe("actorIdFromSession", () => {
  it("returns null for a null/non-object session", () => {
    expect(actorIdFromSession(null)).toBeNull();
    expect(actorIdFromSession("nope" as never)).toBeNull();
  });

  it("reads a top-level id (Clerk/Lucia session shape)", () => {
    expect(actorIdFromSession({ id: "u_123", role: "admin" })).toBe("u_123");
  });

  it("stringifies a non-string top-level id", () => {
    expect(actorIdFromSession({ id: 42 })).toBe("42");
  });

  it("falls back to session.user.id (NextAuth session shape) when no top-level id", () => {
    expect(actorIdFromSession({ user: { id: "u1" } })).toBe("u1");
  });

  it("stringifies a non-string user.id", () => {
    expect(actorIdFromSession({ user: { id: 42 } })).toBe("42");
  });

  it("prefers the top-level id over user.id when both are present", () => {
    expect(actorIdFromSession({ id: "top", user: { id: "nested" } })).toBe("top");
  });

  it("returns null when neither shape has an id", () => {
    expect(actorIdFromSession({ user: {} })).toBeNull();
    expect(actorIdFromSession({})).toBeNull();
  });

  it("treats an empty-string id as no id", () => {
    expect(actorIdFromSession({ id: "" })).toBeNull();
  });

  it("uses the extractor contract when provided, ignoring the default shape", () => {
    const extractor = (s: unknown) => (s as { customId?: string } | null)?.customId ?? null;
    expect(actorIdFromSession({ customId: "abc", id: "should-be-ignored" }, extractor)).toBe("abc");
  });

  it("fails closed (returns null) when the extractor throws", () => {
    const extractor = () => {
      throw new Error("boom");
    };
    expect(actorIdFromSession({ id: "u1" }, extractor)).toBeNull();
  });

  it("stringifies a non-string id returned by the extractor", () => {
    const extractor = () => 99 as unknown as string;
    expect(actorIdFromSession({}, extractor)).toBe("99");
  });
});

function reqCtx(session: Record<string, unknown>, scope: Record<string, unknown> | null = null) {
  return {
    req: new Request("http://localhost/"),
    session,
    role: "admin",
    scope,
    ip: null,
    userAgent: null,
  };
}

function config(extra: Partial<Parameters<typeof defineAdmin>[0]> = {}) {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [],
    ...extra,
  });
}

describe("buildAuditEvent", () => {
  it("uses the default actor fallback chain when no extractor is set", () => {
    const ev = buildAuditEvent(config(), reqCtx({ id: "u1" }), { action: "create" });
    expect(ev.actorId).toBe("u1");
  });

  it("threads auth.userId through to actorIdFromSession", () => {
    const ev = buildAuditEvent(
      config({
        auth: {
          session: async () => null,
          role: () => "admin",
          userId: (s) => (s as { customId?: string } | null)?.customId ?? null,
        },
      }),
      reqCtx({ customId: "c1" }),
      { action: "create" },
    );
    expect(ev.actorId).toBe("c1");
  });

  it("names the actor from theme.user and carries the request's tenant scope", () => {
    const ev = buildAuditEvent(
      config({ theme: { user: () => ({ name: "", email: "ann@example.com" }) } }),
      reqCtx({ id: "u1" }, { tenantId: "t1" }),
      { action: "orders.update", targetIds: ["1", "2"] },
    );
    expect(ev).toMatchObject({
      actorName: "ann@example.com",
      scope: { tenantId: "t1" },
      targetIds: ["1", "2"],
    });
  });

  it("leaves the name out when theme.user throws", () => {
    const ev = buildAuditEvent(
      config({
        theme: {
          user: () => {
            throw new Error("no profile");
          },
        },
      }),
      reqCtx({ id: "u1" }),
      { action: "create" },
    );
    expect(ev).not.toHaveProperty("actorName");
  });
});
