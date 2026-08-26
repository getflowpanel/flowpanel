import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { editConfigToAddResource } from "../../eject/addResource";
import { tpl } from "../../utils/template";
import { parseAdapterKind } from "../new";

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

const tmpRoots: string[] = [];
afterAll(() => {
  for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * `Cannot find name` diagnostics only. The scaffolded config imports from
 * `@flowpanel/kit` and the user's own modules, none of which exist in the
 * fixture, so module-resolution errors are expected and not what is under test.
 */
function undefinedNames(source: string): string[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-new-"));
  tmpRoots.push(dir);
  const file = path.join(dir, "flowpanel.config.ts");
  fs.writeFileSync(file, source);
  const program = ts.createProgram({
    rootNames: [file],
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    },
  });
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.code === 2304)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
}

async function initTemplate(orm: "drizzle" | "prisma"): Promise<string> {
  return tpl(`flowpanel.config.${orm}.ts.txt`, {
    DB: "@/server/lib/db",
    SCHEMA: "@/server/lib/db/schema",
    AUTH: "@/server/lib/auth",
    APP_NAME: "Fixture",
  });
}

describe("editConfigToAddResource against the real init template", () => {
  it("the template it has to edit imports defineAdmin only", async () => {
    const template = await initTemplate("drizzle");
    expect(template).toContain('import { defineAdmin } from "@flowpanel/kit";');
    expect(template).not.toContain("resource }");
  });

  it("adds the resource import the drizzle template lacks", async () => {
    const out = editConfigToAddResource(await initTemplate("drizzle"), "users");
    expect(out).toContain('import { defineAdmin, resource } from "@flowpanel/kit";');
    expect(out).toContain('resource(schema.users, { columns: ["id"] })');
    expect(undefinedNames(out)).toEqual([]);
  });

  it("adds the resource import the prisma template lacks", async () => {
    const out = editConfigToAddResource(await initTemplate("prisma"), "User", { kind: "prisma" });
    expect(out).toContain('import { defineAdmin, resource } from "@flowpanel/kit";');
    expect(out).toContain('resource<unknown>("User", { columns: ["id"] })');
    expect(undefinedNames(out)).toEqual([]);
  });

  it("without the import fix the written config does not resolve `resource`", async () => {
    const unfixed = (await initTemplate("drizzle")).replace(
      "  resources: [",
      '  resources: [\n    resource(schema.users, { columns: ["id"] }),',
    );
    expect(undefinedNames(unfixed)).toContain("Cannot find name 'resource'.");
  });

  it("does not add a second import when one resource entry already exists", async () => {
    const once = editConfigToAddResource(await initTemplate("drizzle"), "users");
    const twice = editConfigToAddResource(once, "orders");
    expect(twice.match(/import \{ defineAdmin, resource \}/g)).toHaveLength(1);
    expect(twice).not.toContain("resource, resource");
    expect(undefinedNames(twice)).toEqual([]);
  });

  it("leaves an import that already binds `resource` untouched", () => {
    const out = editConfigToAddResource(BASE_CONFIG, "orders");
    expect(out.split("\n")[0]).toBe('import { defineAdmin, resource } from "@flowpanel/kit";');
  });

  it("joins the import that brings in defineAdmin, whatever the module is", () => {
    const src = `import { defineAdmin } from "./admin/kit";
import * as schema from "./db/schema";
export default defineAdmin({ resources: [] });
`;
    const out = editConfigToAddResource(src, "orders");
    expect(out).toContain('import { defineAdmin, resource } from "./admin/kit";');
  });

  it("keeps the commented worked example the template ships", async () => {
    const out = editConfigToAddResource(await initTemplate("drizzle"), "users");
    expect(out).toContain('    //   label: "Users",');
    expect(out).toContain('    resource(schema.users, { columns: ["id"] }),');
  });

  it("drops the import instruction it has just carried out", async () => {
    for (const orm of ["drizzle", "prisma"] as const) {
      const template = await initTemplate(orm);
      expect(template).toContain("// Add `resource` to the");
      const out = editConfigToAddResource(template, orm === "prisma" ? "User" : "users", {
        kind: orm,
      });
      expect(out).not.toContain("// Add `resource` to the");
      expect(out).toContain('import { defineAdmin, resource } from "@flowpanel/kit";');
    }
  });
});

describe("parseAdapterKind", () => {
  it("defaults to drizzle when the flag is absent", () => {
    expect(parseAdapterKind(undefined)).toBe("drizzle");
  });

  it("accepts the documented kinds", () => {
    expect(parseAdapterKind("drizzle")).toBe("drizzle");
    expect(parseAdapterKind("prisma")).toBe("prisma");
  });

  it("rejects anything else instead of silently coercing to drizzle", () => {
    expect(parseAdapterKind("mongoose")).toBeNull();
    expect(parseAdapterKind("Prisma")).toBeNull();
    expect(parseAdapterKind("")).toBeNull();
  });
});
