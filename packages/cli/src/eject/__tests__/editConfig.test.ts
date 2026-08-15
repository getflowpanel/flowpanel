import { describe, expect, it } from "vitest";
import { editConfigToCommentDashboard, editConfigToCommentResource } from "../editConfig.js";

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

describe("editConfigToCommentResource", () => {
  it("comments the matching resource(...) call out and inserts a marker", () => {
    const out = editConfigToCommentResource(before, "users");
    expect(out).toContain("// ejected: app/admin/users");
    expect(out).toContain('    // resource(schema.users, { columns: ["email"] }),');
    expect(out).toContain('    resource(schema.jobs, { columns: ["title"] }),');
  });

  it("leaves the entry text intact, so uncommenting restores the original config", () => {
    const out = editConfigToCommentResource(before, "users");
    expect(squash(uncomment(out))).toBe(squash(before));
  });

  it("leaves every line it did not comment byte-identical", () => {
    const out = editConfigToCommentResource(before, "users");
    const changed = out
      .split("\n")
      .filter((line) => !before.split("\n").includes(line))
      .filter((l) => l.trim().length > 0);
    expect(changed).toEqual([
      '    // resource(schema.users, { columns: ["email"] }),',
      "// ejected: app/admin/users",
    ]);
  });

  it("comments out a multi-line call across all of its lines", () => {
    const multiline = `import { defineAdmin, resource } from "@flowpanel/kit";
import * as schema from "./db/schema";

export default defineAdmin({
  resources: [
    resource(schema.users, {
      label: "Users",
      columns: ["email", "name"],
    }),
    resource(schema.jobs, { columns: ["title"] }),
  ],
});
`;
    const out = editConfigToCommentResource(multiline, "users");
    expect(out).toContain(
      [
        "    // resource(schema.users, {",
        '    //   label: "Users",',
        '    //   columns: ["email", "name"],',
        "    // }),",
      ].join("\n"),
    );
    expect(out).toContain('    resource(schema.jobs, { columns: ["title"] }),');
    expect(squash(uncomment(out))).toBe(squash(multiline));
  });

  it("does not eat a comment sitting above the entry", () => {
    const commented = `import { defineAdmin, resource } from "@flowpanel/kit";
import * as schema from "./db/schema";

export default defineAdmin({
  resources: [
    // Support reads this one daily — keep the email column first.
    resource(schema.users, { columns: ["email"] }),
    resource(schema.jobs, { columns: ["title"] }),
  ],
});
`;
    const out = editConfigToCommentResource(commented, "users");
    expect(out).toContain("    // Support reads this one daily — keep the email column first.");
    expect(out).toContain('    // resource(schema.users, { columns: ["email"] }),');
  });

  it("keeps the array indentation of the remaining entries", () => {
    const out = editConfigToCommentResource(before, "jobs");
    expect(out).toContain(
      [
        "  resources: [",
        '    resource(schema.users, { columns: ["email"] }),',
        '    // resource(schema.jobs, { columns: ["title"] }),',
        "  ],",
      ].join("\n"),
    );
  });

  it("block-comments an entry that shares its line with other code", () => {
    const inline = `import { defineAdmin, resource } from "@flowpanel/kit";
export default defineAdmin({
  resources: [resource(schema.users, { columns: ["email"] }), resource(schema.jobs, {})],
});
`;
    const out = editConfigToCommentResource(inline, "users");
    expect(out).toContain('/* resource(schema.users, { columns: ["email"] }), */');
    expect(out).toContain("resource(schema.jobs, {})");
  });

  it("matches by drizzle-style schema.<name>", () => {
    const out = editConfigToCommentResource(before, "users");
    expect(out).not.toMatch(/^\s*resource\(schema\.users/m);
  });

  it('matches by prisma-style string "users"', () => {
    const prismaSrc = `import { defineAdmin, resource } from "@flowpanel/kit";
export default defineAdmin({
  resources: [
    resource<unknown>("users", { columns: ["email"] }),
    resource<unknown>("jobs", { columns: ["title"] }),
  ],
});
`;
    const out = editConfigToCommentResource(prismaSrc, "users");
    expect(out).toContain('    // resource<unknown>("users", { columns: ["email"] }),');
    expect(out).toContain('    resource<unknown>("jobs", { columns: ["title"] }),');
  });

  it("throws when the resource is not found", () => {
    expect(() => editConfigToCommentResource(before, "ghost")).toThrow(/ghost/);
  });

  it("points the comment at src/app when appDir is 'src/app'", () => {
    const out = editConfigToCommentResource(before, "users", "flowpanel.config.ts", "src/app");
    expect(out).toContain("// ejected: src/app/admin/users");
    expect(out).not.toContain("// ejected: app/admin/users");
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
