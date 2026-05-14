import { describe, expect, it } from "vitest";
import { editConfigToCommentResource } from "../editConfig.js";

const before = `import { defineAdmin, resource } from "flowpanel";
import * as schema from "./db/schema";

export default defineAdmin({
  resources: [
    resource(schema.users, { columns: ["email"] }),
    resource(schema.jobs, { columns: ["title"] }),
  ],
});
`;

describe("editConfigToCommentResource", () => {
  it("removes the matching resource(...) call and inserts a marker", () => {
    const out = editConfigToCommentResource(before, "users");
    expect(out).toContain("// ejected: app/admin/users");
    expect(out).not.toMatch(/resource\(schema\.users,/);
    expect(out).toMatch(/resource\(schema\.jobs,/);
  });

  it("matches by drizzle-style schema.<name>", () => {
    const out = editConfigToCommentResource(before, "users");
    expect(out).not.toMatch(/schema\.users/);
  });

  it('matches by prisma-style string "users"', () => {
    const prismaSrc = `import { defineAdmin, resource } from "flowpanel";
export default defineAdmin({
  resources: [
    resource<unknown>("users", { columns: ["email"] }),
    resource<unknown>("jobs", { columns: ["title"] }),
  ],
});
`;
    const out = editConfigToCommentResource(prismaSrc, "users");
    expect(out).not.toMatch(/resource<unknown>\("users",/);
    expect(out).toMatch(/resource<unknown>\("jobs",/);
  });

  it("throws when the resource is not found", () => {
    expect(() => editConfigToCommentResource(before, "ghost")).toThrow(/ghost/);
  });
});
