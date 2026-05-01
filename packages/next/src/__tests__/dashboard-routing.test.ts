import type { DashboardConfig, ResolvedAdminConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { matchDashboard } from "../runtime/dashboard-routing.js";

function makeConfig(dashboards: DashboardConfig[]): ResolvedAdminConfig {
  const dashboardsByPath = new Map<string, DashboardConfig>();
  for (const d of dashboards) dashboardsByPath.set(d.path, d);
  return {
    adapter: {} as ResolvedAdminConfig["adapter"],
    auth: {} as ResolvedAdminConfig["auth"],
    dashboards,
    __resolved: true,
    resourcesByName: new Map(),
    dashboardsByPath,
  } as ResolvedAdminConfig;
}

const home: DashboardConfig = { path: "/", label: "Home", sections: [] };
const monitoring: DashboardConfig = {
  path: "/monitoring",
  label: "Monitoring",
  sections: [],
};

describe("matchDashboard", () => {
  it("returns the root dashboard when slug is empty and '/' is registered", () => {
    const cfg = makeConfig([home, monitoring]);
    expect(matchDashboard([], cfg)).toBe(home);
  });

  it("returns first dashboard when slug is empty and no '/' registered", () => {
    const cfg = makeConfig([monitoring]);
    expect(matchDashboard([], cfg)).toBe(monitoring);
  });

  it("returns null when slug is empty and no dashboards exist", () => {
    const cfg = makeConfig([]);
    expect(matchDashboard([], cfg)).toBeNull();
  });

  it("matches a single-segment slug against '/monitoring'", () => {
    const cfg = makeConfig([home, monitoring]);
    expect(matchDashboard(["monitoring"], cfg)).toBe(monitoring);
  });

  it("returns null when the slug does not match any dashboard path", () => {
    const cfg = makeConfig([home, monitoring]);
    expect(matchDashboard(["users"], cfg)).toBeNull();
  });

  it("matches nested paths", () => {
    const deep: DashboardConfig = {
      path: "/ops/incidents",
      label: "Incidents",
      sections: [],
    };
    const cfg = makeConfig([deep]);
    expect(matchDashboard(["ops", "incidents"], cfg)).toBe(deep);
  });
});
