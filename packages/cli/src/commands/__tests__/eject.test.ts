import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import cliPkg from "../../../package.json" with { type: "json" };
import { ejectVersion, runEject } from "../eject";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-eject-run-"));
  await fs.writeFile(
    path.join(tmp, "flowpanel.config.ts"),
    `import { dashboard, defineAdmin, resource } from "@flowpanel/kit";
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
    expect(cfg).toContain('    // resource(schema.users, { columns: ["email"] }),');
    expect(cfg).toMatch(/^\s*resource\(schema\.jobs,/m);
  });

  it("reports every file it wrote, relative to cwd", async () => {
    const written = await runEject({
      cwd: tmp,
      target: "resource",
      name: "users",
      version: "1.0.0",
    });
    expect(written).toEqual([
      "app/admin/users/page.tsx",
      "app/admin/users/new/page.tsx",
      "app/admin/users/[id]/page.tsx",
      "app/admin/users/[id]/edit/page.tsx",
      "app/admin/users/actions.ts",
    ]);
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
    expect(cfg).toContain('    // dashboard({ path: "/", label: "Overview", sections: [] }),');
    expect(cfg).toMatch(/^\s*dashboard\(\{ path: "\/monitoring"/m);
  });

  it("ejects a sub-path dashboard (/monitoring → app/admin/monitoring/page.tsx)", async () => {
    await runEject({ cwd: tmp, target: "dashboard", name: "/monitoring", version: "1.0.0" });
    const page = await fs.readFile(path.join(tmp, "app/admin/monitoring/page.tsx"), "utf8");
    expect(page).toMatch(/ejected @ 1\.0\.0/);

    const cfg = await fs.readFile(path.join(tmp, "flowpanel.config.ts"), "utf8");
    expect(cfg).toContain("// ejected: app/admin/monitoring");
    expect(cfg).toContain(
      '    // dashboard({ path: "/monitoring", label: "Monitoring", sections: [] }),',
    );
    expect(cfg).toMatch(/^\s*dashboard\(\{ path: "\/", label: "Overview"/m);
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

describe("ejectVersion", () => {
  it("reads the installed kit version", async () => {
    const kit = path.join(tmp, "node_modules/@flowpanel/kit");
    await fs.mkdir(kit, { recursive: true });
    await fs.writeFile(
      path.join(kit, "package.json"),
      JSON.stringify({ name: "@flowpanel/kit", version: "0.4.2" }),
    );
    expect(await ejectVersion(tmp)).toBe("0.4.2");
  });

  it("falls back to the CLI's own version when the kit is not installed", async () => {
    expect(await ejectVersion(tmp)).toBe(cliPkg.version);
  });
});

describe("runEject — invalid", () => {
  it("rejects unknown target", async () => {
    await expect(
      runEject({ cwd: tmp, target: "ghost" as never, name: "x", version: "1.0.0" }),
    ).rejects.toThrow(/Unknown eject target/);
  });
});

describe("runEject — before init", () => {
  let bare: string;
  beforeEach(async () => {
    bare = await fs.mkdtemp(path.join(os.tmpdir(), "fp-eject-bare-"));
  });
  afterEach(async () => {
    await fs.rm(bare, { recursive: true, force: true });
  });

  it("fails with an actionable message instead of a raw ENOENT", async () => {
    await expect(
      runEject({ cwd: bare, target: "resource", name: "users", version: "1.0.0" }),
    ).rejects.toThrow(/flowpanel\.config\.ts not found\. Run `flowpanel init` first/);
  });

  it("leaves no half-ejected files behind (copyResourceTemplates has no rollback)", async () => {
    await expect(
      runEject({ cwd: bare, target: "resource", name: "users", version: "1.0.0" }),
    ).rejects.toThrow();
    await expect(fs.access(path.join(bare, "app/admin/users"))).rejects.toThrow();
    expect(await fs.readdir(bare)).toEqual([]);
  });

  it("checks before ejecting a dashboard too", async () => {
    await expect(
      runEject({ cwd: bare, target: "dashboard", name: "/", version: "1.0.0" }),
    ).rejects.toThrow(/flowpanel\.config\.ts not found/);
    expect(await fs.readdir(bare)).toEqual([]);
  });
});

describe("runEject — src/app project", () => {
  let srcTmp: string;
  beforeEach(async () => {
    srcTmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-eject-srcapp-"));
    await fs.mkdir(path.join(srcTmp, "src/app"), { recursive: true });
    await fs.writeFile(
      path.join(srcTmp, "flowpanel.config.ts"),
      `import { dashboard, defineAdmin, resource } from "@flowpanel/kit";
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
    await fs.rm(srcTmp, { recursive: true, force: true });
  });

  it("ejects a resource under src/app/admin/, not a shadowing root app/", async () => {
    await runEject({ cwd: srcTmp, target: "resource", name: "users", version: "1.0.0" });
    const page = await fs.readFile(path.join(srcTmp, "src/app/admin/users/page.tsx"), "utf8");
    expect(page).toMatch(/ejected @ 1\.0\.0/);
    const cfg = await fs.readFile(path.join(srcTmp, "flowpanel.config.ts"), "utf8");
    expect(cfg).toContain("// ejected: src/app/admin/users");
    await expect(fs.access(path.join(srcTmp, "app"))).rejects.toThrow();
  });

  it("ejects a dashboard under src/app/admin/", async () => {
    await runEject({ cwd: srcTmp, target: "dashboard", name: "/monitoring", version: "1.0.0" });
    const page = await fs.readFile(path.join(srcTmp, "src/app/admin/monitoring/page.tsx"), "utf8");
    expect(page).toMatch(/ejected @ 1\.0\.0/);
    const cfg = await fs.readFile(path.join(srcTmp, "flowpanel.config.ts"), "utf8");
    expect(cfg).toContain("// ejected: src/app/admin/monitoring");
    await expect(fs.access(path.join(srcTmp, "app"))).rejects.toThrow();
  });

  it("ejects the layout under src/app/admin/", async () => {
    await runEject({ cwd: srcTmp, target: "layout", name: "", version: "1.0.0" });
    const layout = await fs.readFile(path.join(srcTmp, "src/app/admin/layout.tsx"), "utf8");
    expect(layout).toMatch(/ejected @ 1\.0\.0/);
    expect(layout).toMatch(/AdminShell/);
    await expect(fs.access(path.join(srcTmp, "app"))).rejects.toThrow();
  });
});
