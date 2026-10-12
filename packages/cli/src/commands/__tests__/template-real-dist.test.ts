import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import type { TableDescription } from "../../scaffold/describe-schema";
import { renderResourceEntry } from "../../scaffold/render-resource";
import { tpl } from "../../utils/template";
import { roleMapping } from "../init-auth";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const KIT = path.join(REPO, "packages/flowpanel");
const BUILT =
  fs.existsSync(path.join(KIT, "dist/index.d.ts")) &&
  fs.existsSync(path.join(REPO, "packages/core/dist/auth.d.ts"));
const roots: string[] = [];

afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

const PROVIDER = [
  "export const auth = Object.assign(async () => null, {",
  "  api: { getSession: async () => null },",
  "  $Infer: {} as { Session: { user: { id: string; role?: string } } },",
  "});",
  "export const lucia = {",
  '  sessionCookieName: "session",',
  "  validateSession: async () => ({ user: null, session: null }),",
  "};",
  "",
].join("\n");

interface SessionModule {
  name: string;
  template: string;
  preset: boolean;
  own?: boolean;
}

const SESSION_MODULES: ReadonlyArray<SessionModule> = [
  { name: "closed stub", template: "auth-session.ts.txt", preset: false },
  { name: "development stub", template: "dev-session.ts.txt", preset: false },
  { name: "better-auth preset", template: "auth-session.better-auth.ts.txt", preset: true },
  { name: "next-auth preset", template: "auth-session.next-auth.ts.txt", preset: true },
  { name: "clerk preset", template: "auth-session.clerk.ts.txt", preset: true },
  { name: "lucia preset", template: "auth-session.lucia.ts.txt", preset: true },
  { name: "own session without a role", template: "", preset: false, own: true },
];

const OWN_SESSION =
  "export async function getSession(): Promise<{ user: { id: string; email: string } } | null> {\n  return null;\n}\n";

const CLOSED_STUB = SESSION_MODULES[0] as SessionModule;
const BETTER_AUTH = SESSION_MODULES[2] as SessionModule;

/** A scaffolded app on the repo's built kit and core, not on stubs. */
async function builtKitApp(orm: "drizzle" | "prisma", session: SessionModule): Promise<string> {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fp-dist-")));
  roots.push(dir);
  fs.mkdirSync(path.join(dir, "node_modules/@flowpanel"), { recursive: true });
  fs.symlinkSync(KIT, path.join(dir, "node_modules/@flowpanel/kit"), "junction");
  write(path.join(dir, "src/db.ts"), "export const db = {} as { query: unknown };\n");
  write(path.join(dir, "src/prisma.ts"), "export const prisma = {} as { $connect(): void };\n");
  write(
    path.join(dir, "src/schema.ts"),
    "export const users = {} as { $inferSelect: { id: string } };\n",
  );
  write(path.join(dir, "src/provider.ts"), PROVIDER);
  write(
    path.join(dir, "src/env.d.ts"),
    "declare const process: { env: Record<string, string | undefined> };\n",
  );
  write(
    path.join(dir, "src/session.ts"),
    session.own
      ? OWN_SESSION
      : await tpl(session.template, { AUTH_MODULE: "@/provider", FILE: "src/session.ts" }),
  );
  write(
    path.join(dir, "flowpanel.config.ts"),
    await tpl(`flowpanel.config.${orm}${session.preset ? ".preset" : ""}.ts.txt`, {
      DB: orm === "prisma" ? "@/prisma" : "@/db",
      SCHEMA: "@/schema",
      AUTH: "@/session",
      APP_NAME: "Fixture",
      ADMIN_PATH: "/admin",
      API_PATH: "/api/admin",
      CLI: "pnpm flowpanel",
      PROVIDER: "postgresql",
      ROLE: roleMapping(session.own ? "own" : "stub"),
    }),
  );
  return dir;
}

function typecheck(root: string, files: string[]): string[] {
  const program = ts.createProgram({
    rootNames: files.map((f) => path.join(root, f)),
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      baseUrl: root,
      paths: { "@/*": ["./src/*"] },
    },
  });
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const where = d.file ? `${path.basename(d.file.fileName)}: ` : "";
    return `${where}TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
  });
}

describe.runIf(BUILT)("every scaffolded config and session module on the real built kit", () => {
  for (const orm of ["drizzle", "prisma"] as const) {
    for (const session of SESSION_MODULES) {
      it(`${orm} config with the ${session.name} compiles without a cast`, async () => {
        const root = await builtKitApp(orm, session);
        expect(typecheck(root, ["flowpanel.config.ts", "src/session.ts", "src/env.d.ts"])).toEqual(
          [],
        );
        expect(fs.readFileSync(path.join(root, "flowpanel.config.ts"), "utf8")).not.toMatch(
          /\w+ as (?:\{|any\b|unknown\b)/,
        );
      }, 60_000);
    }
  }

  it("types the session and the db everywhere a host reads them", async () => {
    const root = await builtKitApp("drizzle", BETTER_AUTH);
    write(
      path.join(root, "probe.ts"),
      [
        'import type { ActionContext, AuthConfig, Session } from "@flowpanel/kit";',
        'import { withBetterAuth } from "@flowpanel/kit/auth";',
        'import { auth } from "@/provider";',
        "declare const action: ActionContext;",
        "export const db: { query: unknown } | undefined = action.unsafe?.db;",
        'export const role = (session: Session | null) => session?.user.role ?? "guest";',
        'export const preset: AuthConfig = withBetterAuth({ auth, role: (s) => s?.user.role ?? "guest" });',
        "",
      ].join("\n"),
    );
    expect(
      typecheck(root, ["flowpanel.config.ts", "src/session.ts", "src/env.d.ts", "probe.ts"]),
    ).toEqual([]);
  }, 60_000);

  it("types the role callback with the shape the stub returns", async () => {
    const root = await builtKitApp("drizzle", CLOSED_STUB);
    write(
      path.join(root, "probe.ts"),
      [
        'import type { Session } from "@flowpanel/kit";',
        'export const role = (session: Session | null): string => session?.user.role ?? "guest";',
        "export const wrong = (session: Session | null) => session?.user.email;",
        "",
      ].join("\n"),
    );
    const errors = typecheck(root, [
      "flowpanel.config.ts",
      "src/session.ts",
      "src/env.d.ts",
      "probe.ts",
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("TS2339");
    expect(errors[0]).toContain("email");
  }, 60_000);

  const POSTS: TableDescription = {
    exportName: "posts",
    tableName: "posts",
    columns: [
      { key: "id", dataType: "number", columnType: "PgSerial", primary: true },
      { key: "title", dataType: "string", columnType: "PgText", primary: false },
      {
        key: "authorId",
        dataType: "string",
        columnType: "PgText",
        primary: false,
        references: { table: "users", labelField: "email" },
      },
      {
        key: "status",
        dataType: "string",
        columnType: "PgEnumColumn",
        primary: false,
        enumValues: ["draft", "live"],
      },
      { key: "publishedAt", dataType: "date", columnType: "PgTimestamp", primary: false },
    ],
  };
  const POST_ROW =
    '{ id: number; title: string; authorId: string; status: "draft" | "live"; publishedAt: Date | null }';

  it("types the reference picker new writes for a Drizzle foreign key", async () => {
    const root = await builtKitApp("drizzle", CLOSED_STUB);
    write(
      path.join(root, "src/blog.ts"),
      `export const posts = {} as { $inferSelect: ${POST_ROW} };\n`,
    );
    write(
      path.join(root, "probe.ts"),
      [
        'import { resource } from "@flowpanel/kit";',
        'import * as schema from "@/blog";',
        `export const posts = ${renderResourceEntry(POSTS, "schema.posts", { hidden: false })};`,
        "",
      ].join("\n"),
    );
    expect(typecheck(root, ["probe.ts", "src/env.d.ts"])).toEqual([]);
  }, 60_000);

  it("types the reference picker new writes for a Prisma relation", async () => {
    const root = await builtKitApp("prisma", CLOSED_STUB);
    const model = { ...POSTS, exportName: "Post" };
    write(
      path.join(root, "probe.ts"),
      [
        'import { resource } from "@flowpanel/kit";',
        'declare module "@flowpanel/kit" {',
        "  interface FlowpanelResources {",
        "    users: { id: string; email: string };",
        `    posts: ${POST_ROW};`,
        "  }",
        "}",
        `export const posts = ${renderResourceEntry(model, '"Post"', { hidden: false, name: "posts" })};`,
        "",
      ].join("\n"),
    );
    expect(typecheck(root, ["probe.ts", "src/env.d.ts"])).toEqual([]);
  }, 60_000);
});
