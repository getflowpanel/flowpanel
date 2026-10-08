import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { editConfigToAddResource } from "../../eject/addResource";
import { tpl } from "../../utils/template";
import { roleMapping } from "../init-auth";
import {
  adapterKindOf,
  checkSchemaExport,
  newCommand,
  parseAdapterKind,
  unlinkedColumns,
} from "../new";
import { runCommand } from "./command-harness";

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
    expect(out).toContain("resource(schema.orders, {})");
    // original resource still present
    expect(out).toContain("resource(schema.users,");
  });

  it("throws when the resource already exists", () => {
    expect(() => editConfigToAddResource(BASE_CONFIG, "users")).toThrow(/already exists/);
  });

  it("creates the resources field if absent", () => {
    const out = editConfigToAddResource(CONFIG_NO_RESOURCES, "products");
    expect(out).toContain("resources:");
    expect(out).toContain("resource(schema.products, {})");
  });

  it("prisma kind produces string literal first arg", () => {
    const out = editConfigToAddResource(CONFIG_NO_RESOURCES, "post", { kind: "prisma" });
    expect(out).toContain('resource("post",');
  });

  it("respects --table override", () => {
    const out = editConfigToAddResource(BASE_CONFIG, "purchases", {
      table: "schema.purchases",
    });
    expect(out).toContain("resource(schema.purchases, {})");
  });

  it("refuses a config whose resources come from elsewhere, instead of adding a second key", () => {
    const split = [
      'import { defineAdmin } from "@flowpanel/kit";',
      'import { resources } from "./resources";',
      "export default defineAdmin({ resources });",
      "",
    ].join("\n");
    expect(() => editConfigToAddResource(split, "orders", { filename: "index.ts" })).toThrow(
      'index.ts takes its resources from `resources` (imported from "./resources"), not an array literal. Write the resource into ./resources with --dir ./resources.',
    );
    const named = split.replace("({ resources })", "({ resources: adminResources })");
    expect(() => editConfigToAddResource(named, "orders")).toThrow(
      "from `adminResources`, not an array literal. Write the resource into that directory with --dir <dir>.",
    );
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
    expect(out).toContain("    resource(schema.posts, {}),\n  ],");
  });

  it("indents a second entry to match the first", () => {
    const out = editConfigToAddResource(BASE_CONFIG, "orders");
    expect(out).toContain(
      '    resource(schema.users, { columns: ["email"] }),\n    resource(schema.orders, {}),',
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
    ADMIN_PATH: "/admin",
    API_PATH: "/api/flowpanel",
    CLI: "pnpm flowpanel",
    PROVIDER: "postgresql",
    ROLE: roleMapping("stub"),
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
    expect(out).toContain("resource(schema.users, {})");
    expect(undefinedNames(out)).toEqual([]);
  });

  it("adds the resource import the prisma template lacks", async () => {
    const out = editConfigToAddResource(await initTemplate("prisma"), "User", { kind: "prisma" });
    expect(out).toContain('import { defineAdmin, resource } from "@flowpanel/kit";');
    expect(out).toContain('resource("User", {})');
    expect(undefinedNames(out)).toEqual([]);
  });

  it("without the import fix the written config does not resolve `resource`", async () => {
    const unfixed = (await initTemplate("drizzle")).replace(
      "  resources: [",
      "  resources: [\n    resource(schema.users, {}),",
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

  it("removes the placeholder comment once it has added the first entry", async () => {
    for (const orm of ["drizzle", "prisma"] as const) {
      const template = await initTemplate(orm);
      expect(template).toMatch(/^ {4}\/\/ pnpm flowpanel new <(table|model)> {2}adds an entry;/m);
      const out = editConfigToAddResource(template, orm === "prisma" ? "User" : "users", {
        kind: orm,
      });
      expect(out).not.toContain("adds an entry");
      expect(out).toContain('import { defineAdmin, resource } from "@flowpanel/kit";');
      expect(out).toMatch(/resources: \[\n {4}resource\(/);
    }
  });

  it("removes the placeholder whichever package manager wrote it", () => {
    for (const cli of ["npx flowpanel", "yarn flowpanel", "bunx flowpanel"]) {
      const source = `import { defineAdmin } from "@flowpanel/kit";
export default defineAdmin({
  resources: [
    // ${cli} new <table>  adds an entry; or write resource(schema.users, {})
  ],
});
`;
      expect(editConfigToAddResource(source, "users")).not.toContain("adds an entry");
    }
  });

  it("drops the import instruction that 0.3 templates carried", () => {
    const legacy = `import { defineAdmin } from "@flowpanel/kit";
export default defineAdmin({
  resources: [
    // Add \`resource\` to the "@flowpanel/kit" import above, then:
  ],
});
`;
    const out = editConfigToAddResource(legacy, "users");
    expect(out).not.toContain("// Add `resource` to the");
    expect(out).toContain('import { defineAdmin, resource } from "@flowpanel/kit";');
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

describe("checkSchemaExport", () => {
  function project(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-schema-"));
    tmpRoots.push(dir);
    return dir;
  }
  const CONFIG = 'import * as schema from "@/db/schema";\n';

  it("still verifies @/… against src/ when the host declares no tsconfig paths", async () => {
    const cwd = project();
    fs.mkdirSync(path.join(cwd, "src/db"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "src/db/schema.ts"), "export const users = {};\n");
    const check = await checkSchemaExport(
      cwd,
      path.join(cwd, "flowpanel.config.ts"),
      CONFIG,
      "users",
    );
    expect(check.status).toBe("ok");
  });

  it("still verifies @/… against the project root when there is no src/ either", async () => {
    const cwd = project();
    fs.mkdirSync(path.join(cwd, "db"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "db/schema.ts"), "export const users = {};\n");
    const check = await checkSchemaExport(
      cwd,
      path.join(cwd, "flowpanel.config.ts"),
      CONFIG,
      "users",
    );
    expect(check.status).toBe("ok");
  });

  it("does not fall back once the host declares its own tsconfig paths", async () => {
    const cwd = project();
    fs.writeFileSync(
      path.join(cwd, "tsconfig.json"),
      '{"compilerOptions":{"paths":{"~/*":["lib/*"]}}}',
    );
    fs.mkdirSync(path.join(cwd, "src/db"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "src/db/schema.ts"), "export const users = {};\n");
    const check = await checkSchemaExport(
      cwd,
      path.join(cwd, "flowpanel.config.ts"),
      CONFIG,
      "users",
    );
    expect(check.status).toBe("unverified");
  });

  it("accepts the SQL table name, and resolves it to the export name", async () => {
    const cwd = project();
    fs.mkdirSync(path.join(cwd, "src/db"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "src/db/schema.ts"),
      'import { pgTable, text } from "drizzle-orm/pg-core";\n' +
        'export const aiUsage = pgTable("ai_usage", { id: text("id") });\n',
    );
    const check = await checkSchemaExport(
      cwd,
      path.join(cwd, "flowpanel.config.ts"),
      CONFIG,
      "ai_usage",
    );
    expect(check).toEqual({ status: "ok", exportName: "aiUsage" });
  });

  it("still resolves a plain export-name match to itself", async () => {
    const cwd = project();
    fs.mkdirSync(path.join(cwd, "src/db"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "src/db/schema.ts"),
      'import { pgTable, text } from "drizzle-orm/pg-core";\n' +
        'export const aiUsage = pgTable("ai_usage", { id: text("id") });\n',
    );
    const check = await checkSchemaExport(
      cwd,
      path.join(cwd, "flowpanel.config.ts"),
      CONFIG,
      "aiUsage",
    );
    expect(check).toEqual({ status: "ok", exportName: "aiUsage" });
  });

  it("names both the export and the table as missing", async () => {
    const cwd = project();
    fs.mkdirSync(path.join(cwd, "src/db"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "src/db/schema.ts"),
      'import { pgTable, text } from "drizzle-orm/pg-core";\n' +
        'export const aiUsage = pgTable("ai_usage", { id: text("id") });\n',
    );
    const check = await checkSchemaExport(
      cwd,
      path.join(cwd, "flowpanel.config.ts"),
      CONFIG,
      "ghost",
    );
    expect(check.status).toBe("missing");
    expect((check as { message: string }).message).toContain(
      'has no export or table named "ghost"',
    );
  });
});

describe("unlinkedColumns", () => {
  it("parses planNewIntoDir's arrow strings into the --json payload shape", () => {
    expect(unlinkedColumns(["userId → user", "orderId → order"])).toEqual([
      { table: "user", column: "userId" },
      { table: "order", column: "orderId" },
    ]);
    expect(unlinkedColumns([])).toEqual([]);
  });
});

describe("adapterKindOf", () => {
  it("reads the adapter the config builds", () => {
    expect(adapterKindOf("adapter: prismaAdapter({ prisma, provider: 'postgresql' }),")).toBe(
      "prisma",
    );
    expect(adapterKindOf("adapter: drizzleAdapter({ db, schema }),")).toBe("drizzle");
    expect(adapterKindOf("export default defineAdmin({});")).toBe("drizzle");
  });
});

describe("new command", () => {
  const NEXT = JSON.stringify({ dependencies: { next: "16.3.4" } });
  const PRISMA_CONFIG = `import { defineAdmin } from "@flowpanel/kit";
import { prismaAdapter } from "@flowpanel/kit/prisma";
import { prisma } from "./prisma";

export default defineAdmin({
  adapter: prismaAdapter({ prisma, provider: "postgresql" }),
  resources: [
    // pnpm flowpanel new <model>  adds an entry; or write resource("User", { columns: ["email"] })
  ],
});
`;

  it("writes the entry the config's adapter takes when --kind is absent", async () => {
    const run = await runCommand(newCommand, ["new", "User", "--json"], {
      "package.json": NEXT,
      "flowpanel.config.ts": PRISMA_CONFIG,
    });
    expect(run.exit).toBeNull();
    expect(JSON.parse(run.stdout)).toMatchObject({ command: "new", applied: true });
  });

  it("names the directory when it is not a Next.js project", async () => {
    const run = await runCommand(newCommand, ["new", "users"], {});
    expect(run.exit).toBe(1);
    expect(run.stderr).toContain(`No Next.js project found in ${run.dir}.`);
    expect(run.stderr).toContain("Run this from your project root.");
  });

  it("puts the wrong-directory message in the JSON document", async () => {
    const run = await runCommand(newCommand, ["new", "users", "--json"], {});
    expect(run.exit).toBe(1);
    expect(JSON.parse(run.stdout)).toMatchObject({ command: "new", applied: false });
  });
});
