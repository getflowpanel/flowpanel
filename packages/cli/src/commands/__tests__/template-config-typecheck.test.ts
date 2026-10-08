import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { tpl } from "../../utils/template";
import { roleMapping } from "../init-auth";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TYPECHECK_TIMEOUT_MS = 20_000;

const roots: string[] = [];

afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

const CORE_STUB = `
export interface FlowpanelTypes {}
export interface FlowpanelResources {}
export type InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown;
export type ResourceName = [keyof FlowpanelResources] extends [never]
  ? string
  : keyof FlowpanelResources & string;
export type Session = FlowpanelTypes extends { session: infer S extends object }
  ? S
  : Record<string, unknown>;
export interface AuthConfig {
  session: (req: Request) => Promise<Session | null>;
  role: (s: Session | null) => string | Promise<string>;
  access?: string | string[];
}
export declare function defineAdmin(config: {
  auth?: AuthConfig;
  [key: string]: unknown;
}): unknown;
export declare function resource(ref: unknown, options?: unknown): unknown;
`;

const KIT_AUTH_STUB = `
import type { AuthConfig } from "./core/index.js";
export type { AuthConfig };
export declare function withBetterAuth(o: { auth: unknown; access?: string }): AuthConfig;
export declare function withNextAuth(o: { auth: unknown; access?: string }): AuthConfig;
export declare function withClerk(o?: { access?: string }): AuthConfig;
export declare function withLucia(o: { lucia: unknown; access?: string }): AuthConfig;
`;

const KIT_INDEX_STUB = `
export type {
  FlowpanelResources,
  FlowpanelTypes,
  InferDB,
  ResourceName,
  Session,
} from "./core/index.js";
export { defineAdmin, resource } from "./core/index.js";
`;

/**
 * A scaffolded app with `@flowpanel/kit` at the app root and core shipped
 * inside the kit's dist, as the published kit lays it out. `flowpanel init`
 * installs only the kit, so this is what the generated config has to compile
 * against.
 */
function kitOnlyApp(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fp-cfg-")));
  roots.push(dir);

  const kit = path.join(dir, "node_modules/@flowpanel/kit");
  write(
    path.join(kit, "package.json"),
    JSON.stringify({
      name: "@flowpanel/kit",
      version: "0.1.0",
      type: "module",
      exports: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
        "./drizzle": { types: "./dist/drizzle.d.ts", import: "./dist/drizzle.js" },
        "./prisma": { types: "./dist/prisma.d.ts", import: "./dist/prisma.js" },
        "./auth": { types: "./dist/auth.d.ts", import: "./dist/auth.js" },
      },
    }),
  );
  write(path.join(kit, "dist/auth.d.ts"), KIT_AUTH_STUB);
  write(path.join(kit, "dist/index.d.ts"), KIT_INDEX_STUB);
  write(
    path.join(kit, "dist/drizzle.d.ts"),
    "export declare function drizzleAdapter(o: unknown): unknown;\n",
  );
  write(
    path.join(kit, "dist/prisma.d.ts"),
    "export declare function prismaAdapter(o: unknown): unknown;\n",
  );

  write(path.join(kit, "dist/core/index.d.ts"), CORE_STUB);

  write(path.join(dir, "src/db.ts"), "export const db = {} as { query: unknown };\n");
  write(path.join(dir, "src/prisma.ts"), "export const prisma = {} as { $connect(): void };\n");
  write(
    path.join(dir, "src/schema.ts"),
    "export const users = {} as { $inferSelect: { id: string; email: string } };\n",
  );
  write(
    path.join(dir, "src/auth.ts"),
    "export async function getSession(): Promise<{ user: { id: string; role: string } } | null> { return null; }\n",
  );
  write(
    path.join(dir, "src/env.d.ts"),
    "declare const process: { env: Record<string, string | undefined> };\n",
  );
  write(
    path.join(dir, "src/provider.ts"),
    "export const auth = { api: { getSession: async () => null }, $Infer: {} as { Session: { user: { id: string; role?: string } } } };\nexport const lucia = {} as { sessionCookieName: string };\n",
  );
  return dir;
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
};

/** `code: message` for every diagnostic, so a failure names the actual error. */
function typecheck(root: string, files: string[]): string[] {
  const program = ts.createProgram({
    rootNames: files.map((f) => path.join(root, f)),
    options: { ...COMPILER_OPTIONS, baseUrl: root, paths: { "@/*": ["./src/*"] } },
  });
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const where = d.file ? `${path.basename(d.file.fileName)}: ` : "";
    return `${where}TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
  });
}

async function renderConfig(
  orm: "drizzle" | "prisma",
  auth: string,
  preset = false,
  session: "stub" | "own" = "stub",
): Promise<string> {
  return tpl(`flowpanel.config.${orm}${preset ? ".preset" : ""}.ts.txt`, {
    DB: orm === "prisma" ? "@/prisma" : "@/db",
    SCHEMA: "@/schema",
    AUTH: auth,
    APP_NAME: "Fixture",
    ADMIN_PATH: "/admin",
    API_PATH: "/api/flowpanel",
    CLI: "pnpm flowpanel",
    PROVIDER: "postgresql",
    ROLE: roleMapping(session),
  });
}

const renderDrizzle = () => renderConfig("drizzle", "@/auth");
const renderPrisma = () => renderConfig("prisma", "@/auth");

describe("generated flowpanel.config.ts type-checks in a kit-only scaffold", () => {
  it(
    "drizzle template compiles clean",
    async () => {
      const root = kitOnlyApp();
      write(path.join(root, "flowpanel.config.ts"), await renderDrizzle());
      expect(typecheck(root, ["flowpanel.config.ts"])).toEqual([]);
    },
    TYPECHECK_TIMEOUT_MS,
  );

  it(
    "prisma template compiles clean",
    async () => {
      const root = kitOnlyApp();
      write(path.join(root, "flowpanel.config.ts"), await renderPrisma());
      expect(typecheck(root, ["flowpanel.config.ts"])).toEqual([]);
    },
    TYPECHECK_TIMEOUT_MS,
  );

  it(
    "the scaffolded dev-session stub satisfies the config's getSession import",
    async () => {
      const root = kitOnlyApp();
      // What init writes when it finds no auth module: the stub replaces the
      // fixture's own src/auth.ts and has to keep the config compiling.
      write(
        path.join(root, "src/auth.ts"),
        await tpl("dev-session.ts.txt", { FILE: "src/auth.ts" }),
      );
      write(path.join(root, "flowpanel.config.ts"), await renderDrizzle());
      expect(typecheck(root, ["flowpanel.config.ts", "src/auth.ts", "src/env.d.ts"])).toEqual([]);
    },
    TYPECHECK_TIMEOUT_MS,
  );

  it(
    'augmenting "@flowpanel/core" instead is what the audit hit (TS2664)',
    async () => {
      const root = kitOnlyApp();
      const regressed = (await renderDrizzle()).replace(
        'declare module "@flowpanel/kit"',
        'declare module "@flowpanel/core"',
      );
      expect(regressed).toContain('declare module "@flowpanel/core"');
      write(path.join(root, "flowpanel.config.ts"), regressed);
      expect(typecheck(root, ["flowpanel.config.ts"]).join("\n")).toContain("TS2664");
    },
    TYPECHECK_TIMEOUT_MS,
  );

  it(
    "the augmentation reaches core's registry, not a kit-local copy",
    async () => {
      const root = kitOnlyApp();
      const filled = (await renderPrisma()).replace(
        "  interface FlowpanelTypes {",
        "  interface FlowpanelResources {\n    User: { id: string };\n  }\n  interface FlowpanelTypes {",
      );
      expect(filled).toContain("User: { id: string };");
      write(path.join(root, "flowpanel.config.ts"), filled);
      // ResourceName is derived from core's FlowpanelResources; it only narrows
      // if the `declare module "@flowpanel/kit"` block merged into core's.
      write(
        path.join(root, "probe.ts"),
        'import type { ResourceName } from "@flowpanel/kit";\nexport const bad: ResourceName = "Nope";\n',
      );
      const errors = typecheck(root, ["flowpanel.config.ts", "probe.ts"]).join("\n");
      expect(errors).toContain("TS2322");
      expect(errors).toContain('"Nope"');
    },
    TYPECHECK_TIMEOUT_MS,
  );
});

const OWN_SESSIONS: Record<string, string> = {
  "with a string role": "{ user: { id: string; role: string } }",
  "without a role": "{ user: { id: string; email: string } }",
  "Auth.js shaped": "{ user?: { name?: string | null; email?: string | null }; expires: string }",
  "better-auth shaped": "{ session: { id: string }; user: { id: string; role?: string | null } }",
  "without a user": "{ userId: string }",
};

describe("every ORM and session source type-checks", () => {
  for (const orm of ["drizzle", "prisma"] as const) {
    for (const [stub, template] of [
      ["closed stub", "auth-session.ts.txt"],
      ["development stub", "dev-session.ts.txt"],
    ] as const) {
      it(
        `${orm} with the ${stub}`,
        async () => {
          const root = kitOnlyApp();
          write(path.join(root, "src/auth.ts"), await tpl(template, { FILE: "src/auth.ts" }));
          write(path.join(root, "flowpanel.config.ts"), await renderConfig(orm, "@/auth"));
          expect(typecheck(root, ["flowpanel.config.ts", "src/auth.ts", "src/env.d.ts"])).toEqual(
            [],
          );
        },
        TYPECHECK_TIMEOUT_MS,
      );
    }
    for (const [label, shape] of Object.entries(OWN_SESSIONS)) {
      it(
        `${orm} with the project's own session ${label}`,
        async () => {
          const root = kitOnlyApp();
          write(
            path.join(root, "src/auth.ts"),
            `export async function getSession(): Promise<${shape} | null> { return null; }\n`,
          );
          write(
            path.join(root, "flowpanel.config.ts"),
            await renderConfig(orm, "@/auth", false, "own"),
          );
          expect(typecheck(root, ["flowpanel.config.ts", "src/auth.ts"])).toEqual([]);
        },
        TYPECHECK_TIMEOUT_MS,
      );
    }
  }
});

it(
  "the stub mapping alone fails on a session without user.role, which is why own sessions get the guarded one",
  async () => {
    const root = kitOnlyApp();
    write(
      path.join(root, "src/auth.ts"),
      `export async function getSession(): Promise<${OWN_SESSIONS["without a role"]} | null> { return null; }\n`,
    );
    write(path.join(root, "flowpanel.config.ts"), await renderConfig("drizzle", "@/auth"));
    expect(typecheck(root, ["flowpanel.config.ts", "src/auth.ts"]).join("\n")).toContain("TS2339");
  },
  TYPECHECK_TIMEOUT_MS,
);

describe("the preset session module init writes per auth provider", () => {
  for (const provider of ["better-auth", "next-auth", "clerk", "lucia"] as const) {
    it(
      `${provider} compiles and satisfies the config's getSession import`,
      async () => {
        const root = kitOnlyApp();
        write(
          path.join(root, "src/session.ts"),
          await tpl(`auth-session.${provider}.ts.txt`, { AUTH_MODULE: "@/provider" }),
        );
        write(
          path.join(root, "flowpanel.config.ts"),
          await renderConfig("drizzle", "@/session", true),
        );
        expect(typecheck(root, ["flowpanel.config.ts", "src/session.ts"])).toEqual([]);
      },
      TYPECHECK_TIMEOUT_MS,
    );
  }

  it("every provider template exports getSession off the preset", async () => {
    for (const provider of ["better-auth", "next-auth", "clerk", "lucia"] as const) {
      const rendered = await tpl(`auth-session.${provider}.ts.txt`, { AUTH_MODULE: "@/provider" });
      expect(rendered).toContain("export const getSession = flowpanelAuth.session;");
      expect(rendered).toContain('from "@flowpanel/kit/auth"');
      expect(rendered).not.toContain("{{");
    }
  });
});

describe("generated config templates", () => {
  it("register the schema, and the better-auth session, on FlowpanelTypes", async () => {
    expect(await renderDrizzle()).toContain("schema: typeof schema;");
    expect(await tpl("auth-session.better-auth.ts.txt", { AUTH_MODULE: "@/provider" })).toContain(
      "session: typeof auth.$Infer.Session;",
    );
  });

  it("register the session the getSession import returns and map the role without a cast", async () => {
    for (const rendered of [await renderDrizzle(), await renderPrisma()]) {
      expect(rendered).toContain("session: NonNullable<Awaited<ReturnType<typeof getSession>>>;");
      expect(rendered).toContain(
        '    session: getSession,\n    role: (s) => s?.user.role ?? "guest",',
      );
      expect(rendered).not.toMatch(/\w+ as (?:\{|any\b|unknown\b)/);
    }
  });

  it("the preset variants hand the whole preset to auth and register no session of their own", async () => {
    for (const orm of ["drizzle", "prisma"] as const) {
      const rendered = await renderConfig(orm, "@/session", true);
      expect(rendered).toContain('import { flowpanelAuth } from "@/session";');
      expect(rendered).toContain("auth: flowpanelAuth,");
      expect(rendered).not.toContain("getSession");
      expect(rendered).not.toContain("session:");
    }
  });

  it("the preset variants differ from the session variants in the auth wiring only", async () => {
    const wiring =
      /^(?:import \{ (?:getSession|flowpanelAuth) \}.*|\s*session: NonNullable.*|\s*auth: (?:flowpanelAuth,|\{[\s\S]*?\n {2}\},))\n/gm;
    for (const orm of ["drizzle", "prisma"] as const) {
      const strip = (source: string) => source.replace(wiring, "");
      expect(strip(await renderConfig(orm, "@/session", true))).toBe(
        strip(await renderConfig(orm, "@/session")),
      );
    }
  });

  it("the placeholder comment names the package manager's binary and no host-specific example", async () => {
    const rendered = (await renderDrizzle()).replaceAll("pnpm flowpanel", "npx flowpanel");
    expect(rendered).toContain(
      '// npx flowpanel new <table>  adds an entry; or write resource(schema.users, { columns: ["email", "name", "createdAt"] })',
    );
    expect(rendered).not.toContain("adminUserRow");
  });

  it("the prisma variant leaves FlowpanelResources to new, so a fresh config has no empty interface", async () => {
    expect(await renderPrisma()).not.toContain("FlowpanelResources");
  });

  it("the umbrella re-exports the canonical core declarations", () => {
    const kitIndex = fs.readFileSync(path.join(HERE, "../../../../flowpanel/src/index.ts"), "utf8");
    expect(kitIndex).toContain('export * from "@flowpanel/core"');
  });
});
