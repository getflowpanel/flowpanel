import { describe, expect, it } from "vitest";
import { actorIdFromSession, buildAuditEvent } from "../runtime/action-helpers.js";

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

describe("buildAuditEvent — actorId", () => {
  it("uses the default fallback chain when no extractor is passed", () => {
    const ev = buildAuditEvent(
      {
        req: new Request("http://localhost/"),
        session: { id: "u1" },
        role: "admin",
        scope: null,
        ip: null,
        userAgent: null,
      },
      { action: "create" },
    );
    expect(ev.actorId).toBe("u1");
  });

  it("threads an explicit extractor through to actorIdFromSession", () => {
    const ev = buildAuditEvent(
      {
        req: new Request("http://localhost/"),
        session: { customId: "c1" },
        role: "admin",
        scope: null,
        ip: null,
        userAgent: null,
      },
      { action: "create" },
      (s) => (s as { customId?: string } | null)?.customId ?? null,
    );
    expect(ev.actorId).toBe("c1");
  });
});
