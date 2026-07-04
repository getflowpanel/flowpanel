import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  copyDashboardTemplate,
  copyLayoutTemplate,
  copyResourceTemplates,
} from "../copyTargets.js";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-eject-cp-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("copyResourceTemplates", () => {
  it("writes 5 files under app/admin/<name>/", async () => {
    const written = await copyResourceTemplates({
      cwd: tmp,
      resourceName: "users",
      version: "1.0.0-beta.0",
    });
    expect(written).toHaveLength(5);
    const pageContents = await fs.readFile(path.join(tmp, "app/admin/users/page.tsx"), "utf8");
    expect(pageContents.split("\n")[0]).toContain("flowpanel: ejected @ 1.0.0-beta.0");
    expect(pageContents).toContain("users"); // {{name}} substituted
    // confirm sibling files exist
    await fs.access(path.join(tmp, "app/admin/users/new/page.tsx"));
    await fs.access(path.join(tmp, "app/admin/users/[id]/page.tsx"));
    await fs.access(path.join(tmp, "app/admin/users/[id]/edit/page.tsx"));
    await fs.access(path.join(tmp, "app/admin/users/actions.ts"));
  });

  it("refuses to overwrite an existing target without force", async () => {
    await fs.mkdir(path.join(tmp, "app/admin/users"), { recursive: true });
    await fs.writeFile(path.join(tmp, "app/admin/users/page.tsx"), "// existing\n");
    await expect(
      copyResourceTemplates({ cwd: tmp, resourceName: "users", version: "1.0.0-beta.0" }),
    ).rejects.toThrow(/already exists/);
  });

  it("overwrites with force: true", async () => {
    await fs.mkdir(path.join(tmp, "app/admin/users"), { recursive: true });
    await fs.writeFile(path.join(tmp, "app/admin/users/page.tsx"), "// existing\n");
    await copyResourceTemplates({
      cwd: tmp,
      resourceName: "users",
      version: "1.0.0-beta.0",
      force: true,
    });
    const out = await fs.readFile(path.join(tmp, "app/admin/users/page.tsx"), "utf8");
    expect(out).toContain("flowpanel: ejected");
    expect(out).not.toContain("// existing");
  });
});

describe("copyTargets on a src/app project", () => {
  it("copyResourceTemplates writes under src/app/admin/<name>/, not a shadowing root app/", async () => {
    await fs.mkdir(path.join(tmp, "src/app"), { recursive: true });
    const written = await copyResourceTemplates({
      cwd: tmp,
      resourceName: "users",
      version: "1.0.0-beta.0",
    });
    expect(written).toHaveLength(5);
    await fs.access(path.join(tmp, "src/app/admin/users/page.tsx"));
    await expect(fs.access(path.join(tmp, "app"))).rejects.toThrow();
  });

  it("copyDashboardTemplate writes under src/app/admin/", async () => {
    await fs.mkdir(path.join(tmp, "src/app"), { recursive: true });
    const written = await copyDashboardTemplate({
      cwd: tmp,
      dashboardPath: "/monitoring",
      version: "1.0.0",
    });
    expect(written).toEqual([path.join(tmp, "src/app/admin/monitoring/page.tsx")]);
    await expect(fs.access(path.join(tmp, "app"))).rejects.toThrow();
  });

  it("copyLayoutTemplate writes under src/app/admin/", async () => {
    await fs.mkdir(path.join(tmp, "src/app"), { recursive: true });
    const written = await copyLayoutTemplate({ cwd: tmp, version: "1.0.0" });
    expect(written).toEqual([path.join(tmp, "src/app/admin/layout.tsx")]);
    await expect(fs.access(path.join(tmp, "app"))).rejects.toThrow();
  });
});
