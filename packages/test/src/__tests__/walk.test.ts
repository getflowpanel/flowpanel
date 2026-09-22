import { describe, expect, it } from "vitest";
import { isUnderBasePath, noNavigation, normalizeBasePath, runSmoke } from "../walk";
import { element, query } from "./fake-dom";
import { FakePage, type FakeRoute } from "./fake-page";

const NAV = ["/admin", "/admin/customers", "/admin/orders"];

function admin(overrides: Record<string, FakeRoute> = {}): Record<string, FakeRoute> {
  return {
    "/admin": { navLinks: NAV },
    "/admin/customers": { navLinks: NAV, rows: 2, rowTargets: ["/admin/customers/1"] },
    "/admin/customers/1": { navLinks: NAV },
    "/admin/orders": { navLinks: NAV, rows: 1 },
    ...overrides,
  };
}

describe("normalizeBasePath", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/", "/admin"],
    ["admin", "/admin"],
    ["/", "/"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeBasePath(input)).toBe(expected);
  });
});

describe("isUnderBasePath", () => {
  it.each([
    ["/admin", true],
    ["/admin/customers", true],
    ["/admin/customers?drawer=customers%3A1", true],
    ["/administrators", false],
    ["/adminx/customers", false],
    ["/other", false],
  ])("decides %s", (route, expected) => {
    expect(isUnderBasePath(route, "/admin")).toBe(expected);
  });
});

describe("the fake page's DOM", () => {
  it("resolves a selector against structure, so a wrong one matches nothing", () => {
    const dom = [element("nav", { "aria-label": "Admin" }, [element("a", { href: "/admin" })])];
    expect(query(dom, "nav a")).toHaveLength(1);
    expect(query(dom, "nav[data-flowpanel-nav] a")).toHaveLength(0);
  });
});

describe("runSmoke", () => {
  it("fails when the nav carries no FlowPanel marker, instead of reporting success", async () => {
    const page = new FakePage({ "/admin": { navLinks: NAV, taggedNav: false } });

    await expect(runSmoke(page, {}, null)).rejects.toThrow(noNavigation("/admin"));
  });

  it("fails when the admin has no navigation at all", async () => {
    const page = new FakePage({ "/admin": { navLinks: [] } });

    await expect(runSmoke(page, {}, null)).rejects.toThrow(
      "is the admin mounted there, and is the session signed in?",
    );
  });

  it("fails when basePath points somewhere that is not an admin", async () => {
    const page = new FakePage(admin());

    await expect(runSmoke(page, { basePath: "/nope" }, null)).rejects.toThrow(
      noNavigation("/nope"),
    );
  });

  it("visits the landing page, every nav route and the first row of a list", async () => {
    const page = new FakePage(admin());
    const report = await runSmoke(page, {}, null);

    expect(report.visited).toEqual([
      "/admin",
      "/admin/customers",
      "/admin/customers/1",
      "/admin/orders",
    ]);
    expect(report.consoleErrors).toEqual([]);
    expect(page.waited.every((selector) => selector === "main")).toBe(true);
  });

  it("counts a drawer that keeps the list route as an opened row", async () => {
    const page = new FakePage(
      admin({
        "/admin/customers": {
          navLinks: NAV,
          rows: 1,
          rowTargets: ["/admin/customers?drawer=customers:1"],
        },
        "/admin/customers?drawer=customers:1": { navLinks: NAV, dialog: true },
      }),
    );
    const report = await runSmoke(page, {}, null);

    expect(report.visited).toContain("/admin/customers?drawer=customers:1");
  });

  it("leaves an inert row alone instead of failing", async () => {
    const page = new FakePage(admin({ "/admin/orders": { navLinks: NAV, rows: 1 } }));
    const report = await runSmoke(page, {}, null);

    expect(report.visited).not.toContain("/admin/orders/1");
  });

  it("opens maxRows rows, returning to the list between them", async () => {
    const page = new FakePage(
      admin({
        "/admin/customers": {
          navLinks: NAV,
          rows: 2,
          rowTargets: ["/admin/customers/1", "/admin/customers/2"],
        },
        "/admin/customers/2": { navLinks: NAV },
      }),
    );
    const report = await runSmoke(page, { maxRows: 2 }, null);

    expect(report.visited).toContain("/admin/customers/1");
    expect(report.visited).toContain("/admin/customers/2");
  });

  it("fails on a status of 400 or more", async () => {
    const page = new FakePage(admin({ "/admin/orders": { navLinks: NAV, status: 500 } }));

    await expect(runSmoke(page, {}, null)).rejects.toThrow("/admin/orders: responded 500");
  });

  it("fails on a rendered FlowPanel error surface", async () => {
    const page = new FakePage(admin({ "/admin/orders": { navLinks: NAV, errorSurface: true } }));

    await expect(runSmoke(page, {}, null)).rejects.toThrow("rendered a FlowPanel error surface");
  });

  it("collects console errors and reports them with the walk", async () => {
    const page = new FakePage(
      admin({ "/admin/orders": { navLinks: NAV, consoleErrors: ["boom"] } }),
    );

    await expect(runSmoke(page, {}, null)).rejects.toThrow(/console\.error: boom/);
    await expect(runSmoke(page, {}, null)).rejects.toThrow(/"visited"/);
  });

  it("attributes every axe finding to the route it was found on", async () => {
    const page = new FakePage(admin());
    const scan = async () => [{ id: "color-contrast", impact: "serious" }];

    await expect(runSmoke(page, {}, scan)).rejects.toThrow(
      /\/admin: axe color-contrast \(serious\)/,
    );
  });

  it("restricts the walk to the requested nav segments", async () => {
    const page = new FakePage(admin());
    const report = await runSmoke(page, { resources: ["customers"] }, null);

    expect(report.visited).not.toContain("/admin/orders");
    expect(report.visited).toContain("/admin/customers");
  });

  it("adds the session cookie against the admin origin before walking", async () => {
    const page = new FakePage(admin());
    const report = await runSmoke(page, { cookie: { name: "session", value: "abc" } }, null);

    expect(page.cookies).toEqual([{ name: "session", value: "abc", url: "http://localhost:3000" }]);
    expect(report.visited.filter((route) => route === "/admin")).toHaveLength(1);
  });

  it("never attributes the pre-authentication page's console errors to the admin", async () => {
    const page = new FakePage(
      admin({
        "/admin": { navLinks: NAV, consoleErrors: ["sign in"], signedIn: { navLinks: NAV } },
      }),
    );
    const report = await runSmoke(page, { cookie: { name: "s", value: "v" } }, null);

    expect(report.consoleErrors).toEqual([]);
  });

  it("scopes the cookie to an explicit domain when one is given", async () => {
    const page = new FakePage(admin());
    await runSmoke(page, { cookie: { name: "s", value: "v", domain: "admin.test" } }, null);

    expect(page.cookies).toEqual([{ name: "s", value: "v", domain: "admin.test", path: "/" }]);
  });

  it.each([
    ["a cross-origin link", "https://example.com/admin/customers"],
    ["a path outside the admin", "/docs"],
    ["a sibling path that only starts the same", "/administrators"],
  ])("skips %s", async (_name, href) => {
    const page = new FakePage(admin({ "/admin": { navLinks: [...NAV, href] } }));
    const report = await runSmoke(page, {}, null);

    expect(report.visited).toEqual([
      "/admin",
      "/admin/customers",
      "/admin/customers/1",
      "/admin/orders",
    ]);
  });
});
