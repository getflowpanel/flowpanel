import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runEject } from "../eject.js";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-eject-run-"));
  await fs.writeFile(
    path.join(tmp, "flowpanel.config.ts"),
    `import { dashboard, defineAdmin, resource } from "flowpanel";
import * as schema from "./db/schema";
export default defineAdmin({
  resources: [
    resource(schema.users, { columns: ["email"] }),
    resource(schema.jobs, { columns: ["title"] }),
  ],
  dashboards: [
    dashboard({ path: "/", label: "Overview", sections: [] }),
    dashboard({ path: "/monitoring", label: "Monitoring", sections: [] }),
  ],
});
`,
  );
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("runEject — resource", () => {
  it("ejects a resource end-to-end (writes files + edits config)", async () => {
    await runEject({ cwd: tmp, target: "resource", name: "users", version: "1.0.0" });
    const page = await fs.readFile(path.join(tmp, "app/admin/users/page.tsx"), "utf8");
    expect(page).toMatch(/ejected @ 1\.0\.0/);
    const cfg = await fs.readFile(path.join(tmp, "flowpanel.config.ts"), "utf8");
    expect(cfg).toContain("// ejected: app/admin/users");
    expect(cfg).not.toMatch(/resource\(schema\.users,/);
    expect(cfg).toMatch(/resource\(schema\.jobs,/);
  });

  it("requires a name for resource", async () => {
    await expect(
      runEject({ cwd: tmp, target: "resource", name: "", version: "1.0.0" }),
    ).rejects.toThrow(/<name> is required/);
  });
});

describe("runEject — dashboard", () => {
  it('ejects the root dashboard ("/" → app/admin/page.tsx)', async () => {
    await runEject({ cwd: tmp, target: "dashboard", name: "/", version: "1.0.0" });
    const page = await fs.readFile(path.join(tmp, "app/admin/page.tsx"), "utf8");
    expect(page).toMatch(/ejected @ 1\.0\.0/);
    expect(page).toMatch(/Ejected dashboard/);

    const cfg = await fs.readFile(path.join(tmp, "flowpanel.config.ts"), "utf8");
    expect(cfg).toContain("// ejected: app/admin");
    expect(cfg).not.toMatch(/path: "\/", label: "Overview"/);
    expect(cfg).toMatch(/path: "\/monitoring"/);
  });

  it("ejects a sub-path dashboard (/monitoring → app/admin/monitoring/page.tsx)", async () => {
    await runEject({ cwd: tmp, target: "dashboard", name: "/monitoring", version: "1.0.0" });
    const page = await fs.readFile(path.join(tmp, "app/admin/monitoring/page.tsx"), "utf8");
    expect(page).toMatch(/ejected @ 1\.0\.0/);

    const cfg = await fs.readFile(path.join(tmp, "flowpanel.config.ts"), "utf8");
    expect(cfg).toContain("// ejected: app/admin/monitoring");
    expect(cfg).not.toMatch(/path: "\/monitoring"/);
    expect(cfg).toMatch(/path: "\/", label: "Overview"/);
  });

  it("requires a path for dashboard", async () => {
    await expect(
      runEject({ cwd: tmp, target: "dashboard", name: "", version: "1.0.0" }),
    ).rejects.toThrow(/<path> is required/);
  });

  it("throws when the dashboard path is not in the config", async () => {
    await expect(
      runEject({ cwd: tmp, target: "dashboard", name: "/ghost", version: "1.0.0" }),
    ).rejects.toThrow(/dashboard with path "\/ghost" not found/);
  });
});

describe("runEject — layout", () => {
  it("ejects the admin layout to app/admin/layout.tsx", async () => {
    await runEject({ cwd: tmp, target: "layout", name: "", version: "1.0.0" });
    const layout = await fs.readFile(path.join(tmp, "app/admin/layout.tsx"), "utf8");
    expect(layout).toMatch(/ejected @ 1\.0\.0/);
    expect(layout).toMatch(/AdminShell/);
    // Layout eject does NOT touch flowpanel.config.ts.
    const cfg = await fs.readFile(path.join(tmp, "flowpanel.config.ts"), "utf8");
    expect(cfg).not.toMatch(/ejected: app\/admin\/layout/);
  });
});

describe("runEject — invalid", () => {
  it("rejects unknown target", async () => {
    await expect(
      runEject({ cwd: tmp, target: "ghost" as never, name: "x", version: "1.0.0" }),
    ).rejects.toThrow(/Unknown eject target/);
  });
});
