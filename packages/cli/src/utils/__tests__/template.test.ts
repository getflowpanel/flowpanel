import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { devSessionStub, planAuthSession } from "../../commands/init-auth";
import {
  configImportTemplateCall,
  configTemplateCall,
  layoutTemplateCall,
  renderCall,
  type TemplateCall,
} from "../../commands/init-templates";
import { FIXABLE_FILES, makeFix } from "../../doctor/templates";
import {
  dashboardTemplateIntents,
  layoutTemplateIntents,
  resourceTemplateIntents,
} from "../../eject/copy-targets";
import { adminPageSource } from "../admin-page";
import { AUTH_PRESETS, type AuthProvider } from "../auth-provider";
import { migrationTemplate } from "../sql-dialect";
import { renderTemplate, tpl } from "../template";

const TEMPLATES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates");
const PLACEHOLDER = /\{\{\s*\w+\s*\}\}/;

async function templateFiles(dir = TEMPLATES): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? templateFiles(path.join(dir, entry.name))
        : [path.relative(TEMPLATES, path.join(dir, entry.name)).split(path.sep).join("/")],
    ),
  );
  return nested.flat();
}

describe("renderTemplate", () => {
  it("substitutes {{KEY}} placeholders", () => {
    expect(renderTemplate("Hello {{NAME}}!", { NAME: "World" })).toBe("Hello World!");
  });
  it("handles multiple keys and whitespace", () => {
    expect(renderTemplate("{{ A }} + {{B}} = {{C}}", { A: "1", B: "2", C: "3" })).toBe("1 + 2 = 3");
  });
  it("keeps $ sequences in a value as they are", () => {
    expect(renderTemplate("{{A}}", { A: "$& $1" })).toBe("$& $1");
  });
  it("throws naming the key and the template when a value is missing", () => {
    expect(() => renderTemplate("Hi {{MISSING}}!", {}, "greeting.txt")).toThrow(
      "greeting.txt uses {{MISSING}}, but no value was given for it.",
    );
  });
  it("does not take a value from the object prototype", () => {
    expect(() => renderTemplate("{{constructor}}", {})).toThrow("{{constructor}}");
  });
  it("names the template file when tpl is short of a value", async () => {
    await expect(tpl("dev-session.ts.txt")).rejects.toThrow("dev-session.ts.txt uses {{FILE}}");
  });
});

/** The calls `init` makes, built by the same functions `init` uses. */
async function initCalls(): Promise<TemplateCall[]> {
  const calls: TemplateCall[] = [];
  for (const orm of ["drizzle", "prisma"] as const) {
    for (const preset of [false, true]) {
      for (const session of ["stub", "own"] as const) {
        calls.push(
          configTemplateCall({
            orm,
            preset,
            db: "@/db",
            schema: "@/db/schema",
            auth: "@/lib/auth",
            appName: "Fixture",
            adminPath: "/admin",
            apiPath: "/api/flowpanel",
            cli: "pnpm flowpanel",
            provider: "postgresql",
            session,
          }),
        );
      }
    }
  }
  for (const hostLayout of [false, true]) {
    for (const cacheComponents of [false, true]) {
      calls.push(layoutTemplateCall(hostLayout, "Fixture", "@/styles/admin.css", cacheComponents));
    }
  }
  for (const template of [
    "api-route.ts.txt",
    "sse-route.ts.txt",
    "admin-not-found.tsx.txt",
  ] as const) {
    calls.push(configImportTemplateCall(template, "@/flowpanel.config"));
  }
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "fp-template-auth-"));
  try {
    await fs.writeFile(
      path.join(cwd, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*"] } } }),
    );
    await fs.mkdir(path.join(cwd, "src/lib"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "src/lib/auth.ts"),
      "export const auth = {};\nexport const lucia = {};\n",
    );
    for (const provider of Object.keys(AUTH_PRESETS) as AuthProvider[]) {
      const plan = await planAuthSession({
        cwd,
        provider,
        detectedAuth: "@/lib/auth",
        aliasMode: "strip-src",
        devAuth: false,
      });
      if (plan === null) throw new Error(`no session plan for ${provider}`);
      calls.push(plan);
    }
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
  const noVars = ["admin.css.txt", "auth-session.ts.txt"];
  for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
    noVars.push(migrationTemplate(dialect));
  }
  return [...calls, ...noVars.map((template) => ({ template, vars: {} }))];
}

describe("every template renders with the variables its caller passes", () => {
  it("init", async () => {
    for (const call of await initCalls()) {
      expect(await renderCall(call), call.template).not.toMatch(PLACEHOLDER);
    }
    for (const cacheComponents of [false, true]) {
      expect(await adminPageSource("@/flowpanel.config", cacheComponents)).not.toMatch(PLACEHOLDER);
    }
    expect(await devSessionStub("src/lib/auth.ts")).not.toMatch(PLACEHOLDER);
  });

  it("doctor --fix", async () => {
    for (const file of FIXABLE_FILES) {
      const configImport = file.needsConfigImport ? "@/flowpanel.config" : null;
      const { content } = await makeFix("out", file.templateName, configImport, true);
      expect(content, file.templateName).not.toMatch(PLACEHOLDER);
    }
  });

  it("eject", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "fp-template-eject-"));
    try {
      const base = { cwd, version: "0.0.0" };
      const intents = [
        ...(await resourceTemplateIntents({ ...base, resourceName: "users" })),
        ...(await dashboardTemplateIntents({ ...base, dashboardPath: "/monitoring" })),
        ...(await layoutTemplateIntents(base)),
      ];
      expect(intents).toHaveLength(7);
      for (const intent of intents) {
        expect(intent.content, intent.path).not.toMatch(PLACEHOLDER);
      }
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  const AUDIT_UPGRADES = (["postgresql", "mysql", "sqlite"] as const).map(
    (dialect) => `migration-audit.${dialect}.sql.txt`,
  );

  it("migrate", async () => {
    for (const name of AUDIT_UPGRADES) expect(await tpl(name), name).not.toMatch(PLACEHOLDER);
  });

  it("leaves no template file without a caller in these tests", async () => {
    const files = await templateFiles();
    const covered = new Set([
      ...(await initCalls()).map((call) => call.template),
      "admin-page.tsx.txt",
      "dev-session.ts.txt",
      ...AUDIT_UPGRADES,
      ...FIXABLE_FILES.map((file) => file.templateName),
      ...files.filter((file) => file.startsWith("ejected/")),
    ]);
    expect(files.filter((file) => !covered.has(file))).toEqual([]);
  });
});
