import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { tpl } from "../../utils/template";

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

/** A scaffolded app on the repo's built kit and core, not on stubs. */
async function builtKitApp(): Promise<string> {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fp-dist-")));
  roots.push(dir);
  fs.mkdirSync(path.join(dir, "node_modules/@flowpanel"), { recursive: true });
  fs.symlinkSync(KIT, path.join(dir, "node_modules/@flowpanel/kit"), "junction");
  write(path.join(dir, "src/db.ts"), "export const db = {} as { query: unknown };\n");
  write(
    path.join(dir, "src/schema.ts"),
    "export const users = {} as { $inferSelect: { id: string } };\n",
  );
  write(
    path.join(dir, "src/provider.ts"),
    "export const auth = { api: { getSession: async () => null }, $Infer: {} as { Session: { user: { id: string; role?: string } } } };\n",
  );
  write(
    path.join(dir, "src/session.ts"),
    await tpl("auth-session.better-auth.ts.txt", { AUTH_MODULE: "@/provider" }),
  );
  write(
    path.join(dir, "flowpanel.config.ts"),
    await tpl("flowpanel.config.drizzle.ts.txt", {
      DB: "@/db",
      SCHEMA: "@/schema",
      AUTH: "@/session",
      APP_NAME: "Fixture",
      ADMIN_PATH: "/admin",
      API_PATH: "/api/admin",
    }),
  );
  write(
    path.join(dir, "probe.ts"),
    [
      'import type { ActionContext, AuthConfig, Session } from "@flowpanel/kit";',
      'import { withBetterAuth } from "@flowpanel/kit/auth";',
      'import { auth } from "@/provider";',
      "declare const action: ActionContext;",
      "export const db: { query: unknown } = action.db;",
      'export const role = (session: Session | null) => session?.user.role ?? "guest";',
      'export const preset: AuthConfig = withBetterAuth({ auth, role: (s) => s?.user.role ?? "guest" });',
      "",
    ].join("\n"),
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

describe.runIf(BUILT)("the scaffolded better-auth pair on the real built kit and core", () => {
  it("types the session and the db everywhere a host reads them", async () => {
    const root = await builtKitApp();
    expect(typecheck(root, ["flowpanel.config.ts", "src/session.ts", "probe.ts"])).toEqual([]);
  }, 60_000);
});
