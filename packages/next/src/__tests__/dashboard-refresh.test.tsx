import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { DashboardRefresh } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { DashboardPage, dashboardRefreshMs } from "../pages/dashboard";

const cfg: ResolvedAdminConfig = {
  basePath: "/admin",
  adapter: { kind: "drizzle", db: {} },
  auth: { session: async () => null, role: () => "admin" },
  resources: [],
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  __resolved: true,
} as never;

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

function findProps(tree: ReactNode, target: unknown): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = findProps(child, target);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === target) return el.props;
  return findProps(el.props.children, target);
}

async function refreshProps(refresh?: string) {
  const node = await DashboardPage({
    config: cfg,
    dashboard: {
      path: "/",
      label: "Overview",
      sections: [],
      ...(refresh ? { refresh: refresh as `${number}s` } : {}),
    },
    searchParams: new URLSearchParams(""),
    req: reqCtx.req,
    reqCtx,
  });
  return findProps(node, DashboardRefresh);
}

describe("dashboardRefreshMs", () => {
  it("reads seconds and minutes", () => {
    expect(dashboardRefreshMs("60s")).toBe(60_000);
    expect(dashboardRefreshMs("5m")).toBe(300_000);
  });

  it("refuses a missing, zero or malformed interval", () => {
    expect(dashboardRefreshMs(undefined)).toBeNull();
    expect(dashboardRefreshMs("0s")).toBeNull();
    expect(dashboardRefreshMs("soon" as never)).toBeNull();
  });
});

describe("DashboardPage refresh", () => {
  it("mounts the refresher with a freshness stamp when refresh is configured", async () => {
    const props = await refreshProps("30s");
    expect(props?.intervalMs).toBe(30_000);
    expect(typeof props?.renderedAt).toBe("number");
  });

  it("mounts nothing when it is not", async () => {
    expect(await refreshProps()).toBeUndefined();
  });
});
