import { describe, expect, it } from "vitest";
import { FlowPanelConfigError } from "../../errors";
import { canAccessPage, resolvePages, serializePages } from "../../pages/resolver";
import type { FlowPanelPage } from "../../pages/types";

// Minimal valid page for tests
function page(p: Partial<FlowPanelPage> & { path: string }): FlowPanelPage {
  return { component: () => null, ...p };
}

describe("pages resolver — resolvePages", () => {
  it("returns empty array for undefined or empty input", () => {
    expect(resolvePages(undefined)).toEqual([]);
    expect(resolvePages([])).toEqual([]);
  });

  it("resolves a minimal page with auto-derived label", () => {
    const [resolved] = resolvePages([page({ path: "reports" })]);
    expect(resolved).toMatchObject({ id: "reports", path: "reports", label: "Reports" });
  });

  it("Title-Cases multi-segment paths", () => {
    const [resolved] = resolvePages([page({ path: "support-tickets" })]);
    expect(resolved?.label).toBe("Support Tickets");
  });

  it("respects explicit label", () => {
    const [resolved] = resolvePages([page({ path: "reports", label: "Monthly Reports" })]);
    expect(resolved?.label).toBe("Monthly Reports");
  });

  it("throws on leading slash in path", () => {
    expect(() => resolvePages([page({ path: "/reports" })])).toThrow(FlowPanelConfigError);
  });

  it("throws on reserved path", () => {
    expect(() => resolvePages([page({ path: "dashboard" })])).toThrow(/reserved/);
  });

  it("throws on missing component", () => {
    expect(() =>
      resolvePages([{ path: "reports", component: null } as unknown as FlowPanelPage]),
    ).toThrow(/missing a "component"/);
  });

  it("throws on duplicate paths", () => {
    expect(() => resolvePages([page({ path: "reports" }), page({ path: "reports" })])).toThrow(
      /duplicate/,
    );
  });

  it("throws when page path collides with a resource id", () => {
    expect(() => resolvePages([page({ path: "user" })], { resourceIds: ["user", "post"] })).toThrow(
      /collides with a resource/,
    );
  });

  it("throws when page path collides with a queue id", () => {
    expect(() => resolvePages([page({ path: "email" })], { queueIds: ["email"] })).toThrow(
      /collides with a queue/,
    );
  });

  it("preserves access and group fields", () => {
    const [resolved] = resolvePages([
      page({ path: "reports", access: ["admin"], group: "analytics" }),
    ]);
    expect(resolved?.access).toEqual(["admin"]);
    expect(resolved?.group).toBe("analytics");
  });
});

describe("pages resolver — serializePages", () => {
  it("strips component and access function", () => {
    const resolved = resolvePages([
      page({ path: "reports", access: () => true, icon: "bar-chart" }),
    ]);
    const [serialized] = serializePages(resolved);
    expect(serialized).not.toHaveProperty("component");
    expect(serialized).not.toHaveProperty("access");
    expect(serialized).toMatchObject({ id: "reports", path: "reports", icon: "bar-chart" });
  });

  it("sets allowed=true for access=undefined", () => {
    const resolved = resolvePages([page({ path: "reports" })]);
    const [serialized] = serializePages(resolved, []);
    expect(serialized?.allowed).toBe(true);
  });

  it("sets allowed=false for access=false", () => {
    const resolved = resolvePages([page({ path: "reports", access: false })]);
    const [serialized] = serializePages(resolved, []);
    expect(serialized?.allowed).toBe(false);
  });

  it("evaluates role-array access against session roles", () => {
    const resolved = resolvePages([page({ path: "reports", access: ["admin"] })]);
    expect(serializePages(resolved, ["user"])[0]?.allowed).toBe(false);
    expect(serializePages(resolved, ["admin"])[0]?.allowed).toBe(true);
  });

  it("optimistically allows function access at serialization level", () => {
    const resolved = resolvePages([page({ path: "reports", access: () => false })]);
    // Function rules are evaluated per-request via canAccessPage — serializer allows.
    expect(serializePages(resolved, [])[0]?.allowed).toBe(true);
  });
});

describe("pages resolver — canAccessPage", () => {
  it("returns true for access=undefined", async () => {
    const [p] = resolvePages([page({ path: "reports" })]);
    expect(await canAccessPage(p!, {})).toBe(true);
  });

  it("returns false for access=false", async () => {
    const [p] = resolvePages([page({ path: "reports", access: false })]);
    expect(await canAccessPage(p!, {})).toBe(false);
  });

  it("evaluates function access with context", async () => {
    const [p] = resolvePages([
      page({
        path: "reports",
        access: (ctx) => (ctx as { role?: string }).role === "admin",
      }),
    ]);
    expect(await canAccessPage(p!, { role: "user" })).toBe(false);
    expect(await canAccessPage(p!, { role: "admin" })).toBe(true);
  });

  it("returns false when function access throws", async () => {
    const [p] = resolvePages([
      page({
        path: "reports",
        access: () => {
          throw new Error("boom");
        },
      }),
    ]);
    expect(await canAccessPage(p!, {})).toBe(false);
  });

  it("handles async access functions", async () => {
    const [p] = resolvePages([
      page({ path: "reports", access: async () => Promise.resolve(true) }),
    ]);
    expect(await canAccessPage(p!, {})).toBe(true);
  });
});
