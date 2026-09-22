import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findAdminRouteConflicts, normalizeAdminPath, readAdminMount } from "../admin-path";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-mount-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
async function write(file: string, text = "export default function Page() { return null; }") {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
}

describe("admin mount preflight", () => {
  it("follows a named re-export rather than a same-named private variable", async () => {
    await write("flowpanel.config.ts", 'export { opsConfig as default } from "./configs";');
    await write(
      "configs.ts",
      'const opsConfig = defineAdmin({ paths: { admin: "/wrong" } }); export { actual as opsConfig } from "./actual";',
    );
    await write("actual.ts", 'export const actual = defineAdmin({ paths: { admin: "/ops" } });');
    expect(await readAdminMount(root)).toEqual({ path: "/ops", api: "/api/flowpanel" });
  });

  it("uses the runtime legacy fallback when paths only configures the API", async () => {
    await write(
      "flowpanel.config.ts",
      'export default defineAdmin({ basePath: "/ops", paths: { api: "/api/internal" } });',
    );
    expect(await readAdminMount(root)).toEqual({ path: "/ops", api: "/api/internal" });
  });

  it("never selects another default when a named config is re-exported", async () => {
    await write("flowpanel.config.ts", 'export { opsConfig as default } from "./configs";');
    await write(
      "configs.ts",
      'export const opsConfig = defineAdmin({ paths: { admin: "/ops" } }); export default defineAdmin({ paths: { admin: "/elsewhere" } });',
    );
    expect(await readAdminMount(root)).toEqual({ path: "/ops", api: "/api/flowpanel" });
  });

  it("finds a route-group collision before generating an optional catch-all", async () => {
    await write("src/app/(dashboard)/admin/page.tsx");
    expect(await findAdminRouteConflicts(root, "src/app", "/admin")).toEqual([
      "src/app/(dashboard)/admin/page.tsx",
    ]);
    expect(await findAdminRouteConflicts(root, "src/app", "/flowpanel")).toEqual([]);
  });

  it("protects routes inside the mount without claiming sibling dynamic branches", async () => {
    await write("app/(ops)/admin/users/page.tsx");
    await write("app/_private/admin/page.tsx");
    await write("app/[tenant]/reports/page.tsx");
    await write("app/admin/[resource]/page.tsx");
    expect(await findAdminRouteConflicts(root, "app", "/admin")).toEqual([
      "app/(ops)/admin/users/page.tsx",
      "app/admin/[resource]/page.tsx",
    ]);
  });

  it("does not treat the homepage or sibling admin-tools as a collision", async () => {
    await write("app/page.tsx");
    await write("app/admin-tools/page.tsx");
    expect(await findAdminRouteConflicts(root, "app", "/admin")).toEqual([]);
  });

  it("allows a static branch beside a parent catch-all but protects its own handlers", async () => {
    await write("app/[[...rest]]/page.tsx");
    await write("app/ops/admin/route.ts");
    expect(await findAdminRouteConflicts(root, "app", "/ops/admin")).toEqual([
      "app/ops/admin/route.ts",
    ]);
  });

  it("accepts the real host's locale and sibling intercepted modal routes", async () => {
    await write("src/app/[locale]/(marketing)/page.tsx");
    await write("src/app/(dashboard)/@modal/(.)order/[id]/page.tsx");
    expect(await findAdminRouteConflicts(root, "src/app", "/new-admin")).toEqual([]);
  });

  it.each([
    "app/@modal/(.)admin/[id]/page.tsx",
    "app/feed/@modal/(..)admin/[id]/page.tsx",
    "app/feed/(group)/details/@modal/(..)(..)admin/[id]/page.tsx",
    "app/feed/details/@modal/(...)admin/[id]/page.tsx",
  ])("resolves interception by URL segments, including %s", async (file) => {
    await write(file);
    expect(await findAdminRouteConflicts(root, "app", "/admin")).toEqual([file]);
    expect(await findAdminRouteConflicts(root, "app", "/ops")).toEqual([]);
  });

  it.each([
    "/",
    "/../admin",
    "/admin?x=1",
    "/[admin]",
    "/_admin",
    "//admin",
    "/admin%2fops",
  ])("rejects non-static or unsafe mount %s", (value) => {
    expect(() => normalizeAdminPath(value)).toThrow();
  });
  it("normalizes a nested path without introducing route syntax", () => {
    expect(normalizeAdminPath("ops/admin/")).toBe("/ops/admin");
  });

  it("reads paths.admin from a decomposed config without executing host imports", async () => {
    await write("flowpanel.config.ts", 'export { default } from "./admin/config";');
    await write(
      "admin/config/index.ts",
      'throw new Error("must not execute"); export default defineAdmin({ paths: { admin: "/ops" } });',
    );
    expect(await readAdminMount(root)).toEqual({ path: "/ops", api: "/api/flowpanel" });
  });

  it("reports a dynamic API mount as unknown rather than as the default", async () => {
    await write(
      "flowpanel.config.ts",
      'export default defineAdmin({ paths: { admin: "/ops", api: process.env.API_PATH } });',
    );
    expect(await readAdminMount(root)).toEqual({ path: "/ops", api: null });
  });

  it("defaults the API mount only when the config declares none", async () => {
    await write("flowpanel.config.ts", 'export default defineAdmin({ paths: { admin: "/ops" } });');
    expect(await readAdminMount(root)).toEqual({ path: "/ops", api: "/api/flowpanel" });
    await write("flowpanel.config.ts", 'export default defineAdmin({ basePath: "/ops" });');
    expect(await readAdminMount(root)).toEqual({ path: "/ops", api: "/api/flowpanel" });
  });

  it("does not guess /admin for a dynamic configured mount", async () => {
    await write(
      "flowpanel.config.ts",
      "export default defineAdmin({ paths: { admin: process.env.ADMIN_PATH } });",
    );
    expect(await readAdminMount(root)).toMatchObject({ error: expect.stringContaining("dynamic") });
  });

  it("reads only the exported config, not unrelated admins in the same tree", async () => {
    await write("flowpanel.config.ts", 'export { default } from "./admin/config";');
    await write("admin/config.ts", 'export default defineAdmin({ paths: { admin: "/ops" } });');
    await write(
      "admin/unrelated.test.ts",
      'const fixture = defineAdmin({ paths: { admin: "/different" } });',
    );
    expect(await readAdminMount(root)).toEqual({ path: "/ops", api: "/api/flowpanel" });
  });

  it("refuses to infer a mount from an unresolved re-export or spread", async () => {
    await write("flowpanel.config.ts", 'export { default } from "./missing";');
    expect(await readAdminMount(root)).toHaveProperty("error");
    await write("flowpanel.config.ts", "export default defineAdmin({ ...settings });");
    expect(await readAdminMount(root)).toHaveProperty("error");
  });
});
