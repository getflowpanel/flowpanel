import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../program";

let root: string;
async function write(file: string, content: string) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), content);
}
async function install(name: string, version: string, extra: Record<string, unknown> = {}) {
  await write(`node_modules/${name}/package.json`, JSON.stringify({ name, version, ...extra }));
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-init-mount-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  await write(
    "package.json",
    JSON.stringify({
      dependencies: {
        next: "16.3.0",
        "drizzle-orm": "0.45.2",
        tailwindcss: "4.3.0",
        "@flowpanel/kit": "0.1.0",
        "@flowpanel/cli": "0.1.0",
      },
    }),
  );
  await Promise.all([
    install("next", "16.3.0", { engines: { node: ">=20" } }),
    install("react", "19.2.0"),
    install("react-dom", "19.2.0"),
    install("drizzle-orm", "0.45.2"),
    install("typescript", "5.9.0", { bin: { tsc: "bin/tsc" } }),
    install("@flowpanel/kit", "0.1.0"),
    install("@flowpanel/cli", "0.1.0"),
  ]);
  await write(
    "src/app/layout.tsx",
    "export default function Layout({children}) { return <html><body>{children}</body></html>; }",
  );
  await write("src/lib/db.ts", "export const db = {};");
  await write("src/lib/db/schema.ts", "export const users = {};");
  await write("src/lib/auth.ts", "export async function getSession() { return null; }");
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

describe("init mount integration", () => {
  it("refuses a mount that collides with the API routes it is about to create", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("init refused");
    });
    await expect(
      createProgram().parseAsync([
        "node",
        "flowpanel",
        "init",
        "--yes",
        "--json",
        "--path",
        "/api/flowpanel",
      ]),
    ).rejects.toThrow("init refused");
    await expect(fs.stat(path.join(root, "flowpanel.config.ts"))).rejects.toThrow();
  });

  it("keeps the stylesheet import in the admin layout and preserves the host root layout", async () => {
    const rootLayout = await fs.readFile(path.join(root, "src/app/layout.tsx"), "utf8");
    await createProgram().parseAsync(["node", "flowpanel", "init", "--yes", "--json"]);
    expect(await fs.readFile(path.join(root, "src/app/layout.tsx"), "utf8")).toBe(rootLayout);
    const layout = await fs.readFile(path.join(root, "src/app/admin/layout.tsx"), "utf8");
    expect(layout).toContain('"../../../styles/admin.css"');
  });

  it("fails before writing when a detected DB module lacks the required export", async () => {
    await write("src/lib/db.ts", "export const connection = {};");
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("init refused");
    });
    await expect(
      createProgram().parseAsync(["node", "flowpanel", "init", "--yes", "--json"]),
    ).rejects.toThrow("init refused");
    await expect(fs.stat(path.join(root, "flowpanel.config.ts"))).rejects.toThrow();
  });

  it("finds FSD index modules and keeps unknown auth closed", async () => {
    await fs.rm(path.join(root, "src/lib"), { recursive: true });
    await write("src/shared/lib/db/index.ts", "export const db = {};");
    await write("src/shared/lib/db/schema/index.ts", "export const users = {};");
    await createProgram().parseAsync(["node", "flowpanel", "init", "--yes", "--json"]);
    const config = await fs.readFile(path.join(root, "flowpanel.config.ts"), "utf8");
    expect(config).toContain("./src/shared/lib/db/index");
    const { createJiti } = await import("jiti");
    const session = (await createJiti(root).import(path.join(root, "server/lib/auth.ts"))) as {
      getSession: () => Promise<unknown>;
    };
    expect(await session.getSession()).toBeNull();
  });

  it("preserves a grouped /admin and writes one consistent fallback mount", async () => {
    const legacy = "export default function LegacyAdmin() { return null; }";
    await write("src/app/(dashboard)/admin/page.tsx", legacy);
    await createProgram().parseAsync(["node", "flowpanel", "init", "--yes", "--json"]);
    expect(await fs.readFile(path.join(root, "src/app/(dashboard)/admin/page.tsx"), "utf8")).toBe(
      legacy,
    );
    expect(await fs.readFile(path.join(root, "flowpanel.config.ts"), "utf8")).toContain(
      'admin: "/flowpanel"',
    );
    expect(await fs.stat(path.join(root, "src/app/flowpanel/[[...slug]]/page.tsx"))).toBeDefined();
    await expect(fs.stat(path.join(root, "src/app/admin/[[...slug]]/page.tsx"))).rejects.toThrow();
  });

  it("uses an explicit nested mount for both config and route imports", async () => {
    await createProgram().parseAsync([
      "node",
      "flowpanel",
      "init",
      "--yes",
      "--json",
      "--path",
      "/ops/control",
    ]);
    expect(await fs.readFile(path.join(root, "flowpanel.config.ts"), "utf8")).toContain(
      'admin: "/ops/control"',
    );
    const page = await fs.readFile(
      path.join(root, "src/app/ops/control/[[...slug]]/page.tsx"),
      "utf8",
    );
    expect(page).toContain('"../../../../../flowpanel.config"');
  });
});
