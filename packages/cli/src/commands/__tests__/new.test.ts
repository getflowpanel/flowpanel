import { describe, expect, it } from "vitest";
import { editConfigToAddResource } from "../../eject/addResource.js";

const BASE_CONFIG = `import { defineAdmin, resource } from "@flowpanel/kit";
import * as schema from "./db/schema";
export default defineAdmin({
  resources: [
    resource(schema.users, { columns: ["email"] }),
  ],
});
`;

const CONFIG_NO_RESOURCES = `import { defineAdmin } from "@flowpanel/kit";
export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
});
`;

describe("editConfigToAddResource", () => {
  it("adds a new resource to an existing array", () => {
    const out = editConfigToAddResource(BASE_CONFIG, "orders");
    expect(out).toContain('resource(schema.orders, { columns: ["id"] })');
    // original resource still present
    expect(out).toContain("resource(schema.users,");
  });

  it("throws when the resource already exists", () => {
    expect(() => editConfigToAddResource(BASE_CONFIG, "users")).toThrow(/already exists/);
  });

  it("creates the resources field if absent", () => {
    const out = editConfigToAddResource(CONFIG_NO_RESOURCES, "products");
    expect(out).toContain("resources:");
    expect(out).toContain('resource(schema.products, { columns: ["id"] })');
  });

  it("prisma kind produces string literal first arg", () => {
    const out = editConfigToAddResource(CONFIG_NO_RESOURCES, "post", { kind: "prisma" });
    expect(out).toContain('resource<unknown>("post",');
  });

  it("respects --table override", () => {
    const out = editConfigToAddResource(BASE_CONFIG, "purchases", {
      table: "schema.purchases",
    });
    expect(out).toContain('resource(schema.purchases, { columns: ["id"] })');
  });
});

const CONFIG_COMMENTED = `import { defineAdmin, resource } from "@flowpanel/kit";
import * as schema from "./db/schema";
export default defineAdmin({
  resources: [
    // resource(schema.users, {
    //   label: "Users",
    // }),
  ],
});
`;

describe("editConfigToAddResource formatting", () => {
  it("keeps the commented example the scaffold leaves behind", () => {
    const out = editConfigToAddResource(CONFIG_COMMENTED, "posts");
    expect(out).toContain('//   label: "Users",');
    expect(out).toContain('    resource(schema.posts, { columns: ["id"] }),\n  ],');
  });

  it("indents a second entry to match the first", () => {
    const out = editConfigToAddResource(BASE_CONFIG, "orders");
    expect(out).toContain(
      '    resource(schema.users, { columns: ["email"] }),\n    resource(schema.orders, { columns: ["id"] }),',
    );
  });

  it("leaves everything outside the resources array byte-identical", () => {
    const out = editConfigToAddResource(BASE_CONFIG, "orders");
    expect(out.startsWith('import { defineAdmin, resource } from "@flowpanel/kit";\n')).toBe(true);
    expect(out.endsWith("});\n")).toBe(true);
  });
});
