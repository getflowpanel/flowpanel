import { describe, expect, it } from "vitest";
import { definesResource, editConfigToCommentDashboard } from "../editConfig";

const before = `import { defineAdmin, resource } from "@flowpanel/kit";
import * as schema from "./db/schema";

export default defineAdmin({
  resources: [
    resource(schema.users, { columns: ["email"] }),
    resource(schema.jobs, { columns: ["title"] }),
  ],
});
`;

/** What a user does by hand to revert an eject: drop the breadcrumb, unprefix `//`. */
function uncomment(source: string): string {
  return source
    .replace(/\n*\/\/ ejected:[^\n]*\n?/g, "")
    .split("\n")
    .map((line) => line.replace(/^(\s*)\/\/ ?/, "$1"))
    .join("\n");
}

const squash = (s: string): string =>
  s
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

describe("definesResource", () => {
  it("finds a drizzle-style schema.<name> entry", () => {
    expect(definesResource(before, "users")).toBe(true);
    expect(definesResource(before, "jobs")).toBe(true);
  });

  it('finds a prisma-style "Name" entry', () => {
    const prismaSrc = `import { defineAdmin, resource } from "@flowpanel/kit";
export default defineAdmin({
  resources: [resource<unknown>("users", { columns: ["email"] })],
});
`;
    expect(definesResource(prismaSrc, "users")).toBe(true);
  });

  it("finds nothing for a name the config does not register", () => {
    expect(definesResource(before, "ghost")).toBe(false);
  });
});

describe("commenting an entry out", () => {
  const multiline = `import { dashboard, defineAdmin } from "@flowpanel/kit";

export default defineAdmin({
  dashboards: [
    // The team opens this first.
    dashboard({
      path: "/",
      label: "Overview",
    }),
    dashboard({ path: "/jobs", label: "Jobs" }),
  ],
});
`;

  it("comments a multi-line call across its lines, keeping the comment above it", () => {
    const out = editConfigToCommentDashboard(multiline, "/");
    expect(out).toContain(
      [
        "    // The team opens this first.",
        "    // dashboard({",
        '    //   path: "/",',
        '    //   label: "Overview",',
        "    // }),",
        '    dashboard({ path: "/jobs", label: "Jobs" }),',
      ].join("\n"),
    );
  });

  it("block-comments an entry that shares its line with other code", () => {
    const inline = `export default defineAdmin({
  dashboards: [dashboard({ path: "/" }), dashboard({ path: "/jobs" })],
});
`;
    const out = editConfigToCommentDashboard(inline, "/");
    expect(out).toContain('/* dashboard({ path: "/" }), */');
  });

  it("refuses an entry outside an array instead of writing undefined in its place", () => {
    const lone = `export const overview = dashboard({ path: "/" });
`;
    expect(() => editConfigToCommentDashboard(lone, "/")).toThrow(/not an array entry/);
  });
});

const withDashboards = `import { dashboard, defineAdmin } from "@flowpanel/kit";

export default defineAdmin({
  dashboards: [
    dashboard({ path: "/", label: "Overview", sections: [] }),
    dashboard({ path: "/monitoring", label: "Monitoring", sections: [] }),
  ],
});
`;

describe("editConfigToCommentDashboard", () => {
  it("comments the matching dashboard out in place", () => {
    const out = editConfigToCommentDashboard(withDashboards, "/monitoring");
    expect(out).toContain(
      '    // dashboard({ path: "/monitoring", label: "Monitoring", sections: [] }),',
    );
    expect(out).toContain('    dashboard({ path: "/", label: "Overview", sections: [] }),');
    expect(out).toContain("// ejected: app/admin/monitoring");
  });

  it("uncommenting restores the original config", () => {
    const out = editConfigToCommentDashboard(withDashboards, "/");
    expect(squash(uncomment(out))).toBe(squash(withDashboards));
  });

  it("throws when the dashboard path is not in the config", () => {
    expect(() => editConfigToCommentDashboard(withDashboards, "/ghost")).toThrow(/ghost/);
  });
});
