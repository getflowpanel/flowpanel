import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createFilesystemPlan, publicPlan } from "../../plan/filesystem-plan";
import { applyFilesystemPlan } from "../../plan/transaction";
import { findAdminConfig } from "../config-target";
import { planNewIntoDir } from "../plan-new";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const runs: string[] = [];

function project(): string {
  const run = mkdtempSync(join(FIXTURES, ".run-"));
  runs.push(run);
  cpSync(join(FIXTURES, "project"), run, { recursive: true });
  return run;
}

afterEach(() => {
  for (const run of runs.splice(0)) rmSync(run, { recursive: true, force: true });
});

const DIR = "admin/config/resources";

describe("findAdminConfig", () => {
  it("follows the root config's re-export through the tsconfig alias", async () => {
    const cwd = project();
    const found = await findAdminConfig(cwd);
    expect(found?.root).toBe(join(cwd, "flowpanel.config.ts"));
    expect(found?.file).toBe(join(cwd, "admin/config/index.ts"));
  });
});

describe("planNewIntoDir", () => {
  it("plans the resource file and the index entry, by table name", async () => {
    const cwd = project();
    const { intents, unlinked } = await planNewIntoDir(cwd, "user_visit", {
      dir: DIR,
      hidden: true,
    });
    expect(unlinked).toEqual([]);
    expect(intents.map((intent) => intent.path)).toEqual([
      `${DIR}/user-visit.ts`,
      `${DIR}/index.ts`,
    ]);
    expect(intents[0]?.content).toContain('import * as schema from "@/db/schema";');
    expect(intents[0]?.content).toContain("export const userVisit = resource(schema.userVisit, {");
    expect(intents[0]?.content).toContain("  hidden: true,");
    expect(intents[0]?.content).toContain(
      '{ field: "userId", label: "User", reference: { resource: "user", labelField: "name" } },',
    );
    expect(intents[1]?.content).toContain('import { userVisit } from "./user-visit";');
    const plan = publicPlan(await createFilesystemPlan(cwd, intents));
    expect(plan.summary).toEqual({ create: 1, modify: 1, skip: 0, conflict: 0 });
  });

  it("accepts an absolute --dir, planning project-relative intents", async () => {
    const cwd = project();
    const { intents, unlinked } = await planNewIntoDir(cwd, "user_visit", {
      dir: join(cwd, DIR),
      hidden: true,
    });
    expect(unlinked).toEqual([]);
    expect(intents.map((intent) => intent.path)).toEqual([
      `${DIR}/user-visit.ts`,
      `${DIR}/index.ts`,
    ]);
    expect(intents[0]?.content).toContain('import * as schema from "@/db/schema";');
    const plan = publicPlan(await createFilesystemPlan(cwd, intents));
    expect(plan.summary).toEqual({ create: 1, modify: 1, skip: 0, conflict: 0 });
  });

  it("is idempotent: a second run plans nothing", async () => {
    const cwd = project();
    const first = await planNewIntoDir(cwd, "user_visit", { dir: DIR, hidden: true });
    await applyFilesystemPlan(await createFilesystemPlan(cwd, first.intents));
    const second = await planNewIntoDir(cwd, "userVisit", { dir: DIR, hidden: true });
    const again = publicPlan(await createFilesystemPlan(cwd, second.intents));
    expect(again.summary).toEqual({ create: 0, modify: 0, skip: 2, conflict: 0 });
  });

  it("writes a relative schema import relative to the resource directory", async () => {
    const cwd = project();
    const config = join(cwd, "admin/config/index.ts");
    writeFileSync(
      config,
      readFileSync(config, "utf8").replace('"@/db/schema"', '"../../db/schema"'),
    );
    const { intents } = await planNewIntoDir(cwd, "user", { dir: DIR, hidden: false });
    expect(intents[0]?.content).toContain('import * as schema from "../../../db/schema";');
  });

  it("writes a foreign key to a table the admin does not list yet as a plain column", async () => {
    const cwd = project();
    writeFileSync(join(cwd, DIR, "user.ts"), "export const user = {};\n");
    const { intents, unlinked } = await planNewIntoDir(cwd, "invoice", { dir: DIR, hidden: false });
    expect(unlinked).toEqual(["userId → user"]);
    expect(intents[0]?.content).toContain('    "userId",');
    expect(intents[0]?.content).not.toContain("reference");
  });

  it("points a reference at the name the target resource is registered under", async () => {
    const cwd = project();
    writeFileSync(
      join(cwd, DIR, "user.ts"),
      [
        'import { resource } from "@flowpanel/kit";',
        'import * as schema from "@/db/schema";',
        "",
        "export const user = resource(schema.user, {",
        '  name: "members",',
        '  columns: ["id", "name"],',
        '  views: [{ name: "Recent", filters: {} }],',
        "});",
        "",
      ].join("\n"),
    );
    const { intents, unlinked } = await planNewIntoDir(cwd, "invoice", { dir: DIR, hidden: false });
    expect(unlinked).toEqual([]);
    expect(intents[0]?.content).toContain(
      '{ field: "userId", label: "User", reference: { resource: "members", labelField: "name" } },',
    );
    expect(intents[0]?.content).toContain(
      '      { name: "userId", label: "User", reference: { resource: "members", labelField: "name" } },',
    );
  });

  it("names the tables there are when the name matches none", async () => {
    const cwd = project();
    await expect(planNewIntoDir(cwd, "user_vist", { dir: DIR, hidden: false })).rejects.toThrow(
      'has no table "user_vist". Tables: invoice, user, user_visit',
    );
  });
});
