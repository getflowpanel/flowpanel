import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runDoctorChecks } from "../doctor";

vi.mock("node:child_process", async (original) => ({
  ...(await original<typeof import("node:child_process")>()),
  execSync: vi.fn(),
}));
let root: string;
async function write(file: string, content: string) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), content);
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-doctor-mount-"));
  await write(
    "package.json",
    '{"dependencies":{"next":"16.3.0","drizzle-orm":"0.45.2","typescript":"5.5.0"}}',
  );
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it("repairs the configured mount without recreating conflicting /admin", async () => {
  await write("flowpanel.config.ts", 'export { default } from "./admin/config";');
  await write(
    "admin/config/index.ts",
    'export default defineAdmin({ paths: { admin: "/new-admin" } });',
  );
  await write("src/app/(dashboard)/admin/page.tsx", "export default () => null;");
  const result = await runDoctorChecks(root, true, { quiet: true });
  expect(result.checks.find((c) => c.name === "Catch-all admin page")?.ok).toBe(true);
  expect(await fs.stat(path.join(root, "src/app/new-admin/[[...slug]]/page.tsx"))).toBeDefined();
  await expect(fs.stat(path.join(root, "src/app/admin/[[...slug]]/page.tsx"))).rejects.toThrow();
});

it("refuses automatic route repair when the configured URL is occupied", async () => {
  await write("flowpanel.config.ts", 'export default defineAdmin({ paths: { admin: "/admin" } });');
  await write("app/(dashboard)/admin/page.tsx", "export default () => null;");
  const result = await runDoctorChecks(root, true, { quiet: true });
  expect(result.checks.find((c) => c.name === "Catch-all admin page")?.ok).toBe(false);
  await expect(fs.stat(path.join(root, "app/admin/[[...slug]]/page.tsx"))).rejects.toThrow();
});

it("does not invent a route for dynamic paths", async () => {
  await write("flowpanel.config.ts", "export default defineAdmin({ paths: getPaths() });");
  const result = await runDoctorChecks(root, true, { quiet: true });
  expect(result.checks.find((c) => c.name === "Admin mount configuration")?.ok).toBe(false);
  await expect(fs.stat(path.join(root, "app/admin/[[...slug]]/page.tsx"))).rejects.toThrow();
});
