import { describe, expect, it } from "vitest";
import { buildDocBreadcrumbs, findDocSection } from "./breadcrumbs";

describe("docs breadcrumbs", () => {
  it("names a page's section after the sidebar folder that lists it", () => {
    expect(buildDocBreadcrumbs("/docs/guides/permissions", "Roles and permissions")).toEqual([
      { label: "Production" },
      { label: "Roles and permissions" },
    ]);
    expect(findDocSection("/docs/guides/upgrade")).toEqual({
      name: "Getting started",
      url: "/docs/introduction/getting-started",
    });
  });

  it("shows one crumb when the page and its section share a name", () => {
    expect(buildDocBreadcrumbs("/docs/troubleshooting", "Troubleshooting")).toEqual([
      { label: "Troubleshooting" },
    ]);
  });
});
