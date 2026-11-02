import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { printConfigWarnings, readConfigWarnings } from "../config-warnings";

const dirs: string[] = [];

async function project(config?: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fp-warnings-"));
  dirs.push(dir);
  if (config !== undefined) await fs.writeFile(path.join(dir, "flowpanel.config.ts"), config);
  return dir;
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});

const WARNING =
  "resource users: create is enabled but required column `email` has no field; creation will always fail";

describe("the warnings doctor reads from a project's config", () => {
  it("returns the resolved config's own warnings", async () => {
    const dir = await project(
      `export default { __resolved: true, warnings: ${JSON.stringify([WARNING])} };`,
    );
    expect(await readConfigWarnings(dir)).toEqual({ warnings: [WARNING] });
  });

  it("is quiet for a project with no config", async () => {
    expect(await readConfigWarnings(await project())).toEqual({ warnings: [] });
  });

  it("reports why the config could not be evaluated instead of saying nothing", async () => {
    const dir = await project('throw new Error("DATABASE_URL is not set");');
    const result = await readConfigWarnings(dir);
    expect(result).toEqual({ unreadable: expect.stringContaining("DATABASE_URL is not set") });
  });

  it("ignores a config whose warnings are not strings", async () => {
    const dir = await project('export default { warnings: [1, null, "real"] };');
    expect(await readConfigWarnings(dir)).toEqual({ warnings: ["real"] });
  });
});

describe("the audit table probe", () => {
  const failingWith = (message: string): string =>
    `export default { warnings: [], auditLog: { list: async () => { throw new Error(${JSON.stringify(message)}); } } };`;

  async function withDatabaseUrl<T>(run: () => Promise<T>): Promise<T> {
    const saved = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://probe.invalid/app";
    try {
      return await run();
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
    }
  }

  it("names the missing 0.4 columns", async () => {
    const dir = await project(failingWith('column "scope_key" does not exist'));
    expect(await withDatabaseUrl(() => readConfigWarnings(dir))).toEqual({
      warnings: [],
      auditTable: "columns",
    });
  });

  it("tells a table missing only the preview column from one missing the 0.4 columns", async () => {
    const dir = await project(failingWith('column "diff_preview" does not exist'));
    expect(await withDatabaseUrl(() => readConfigWarnings(dir))).toEqual({
      warnings: [],
      auditTable: "preview",
    });
  });

  it("names a missing table", async () => {
    const dir = await project(failingWith('relation "flowpanel_audit_log" does not exist'));
    expect(await withDatabaseUrl(() => readConfigWarnings(dir))).toEqual({
      warnings: [],
      auditTable: "table",
    });
  });

  it("names the resources whose table is missing, through the adapter's count", async () => {
    const dir = await project(`
      const missing = (ref) => { throw new Error(\`relation "\${ref}" does not exist\`); };
      export default {
        warnings: [],
        adapter: { count: async (ref) => (ref === "users" ? missing(ref) : 3) },
        resourcesByName: new Map([["users", { ref: "users" }], ["orders", { ref: "orders" }]]),
      };`);
    expect(await withDatabaseUrl(() => readConfigWarnings(dir))).toEqual({
      warnings: [],
      missingTables: ["users"],
    });
  });

  it("judges nothing on another error or without DATABASE_URL", async () => {
    const offline = await project(failingWith("connect ECONNREFUSED"));
    expect(await withDatabaseUrl(() => readConfigWarnings(offline))).toEqual({ warnings: [] });
    const unset = await project(failingWith('column "scope_key" does not exist'));
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(await readConfigWarnings(unset)).toEqual({ warnings: [] });
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });
});

describe("printing them", () => {
  it("writes one warning line each and nothing when there are none", () => {
    const written = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printConfigWarnings({ warnings: [] });
    expect(written).not.toHaveBeenCalled();
    printConfigWarnings({ warnings: ["create will fail", "and so will this"] });
    expect(written).toHaveBeenCalledTimes(2);
    expect(written.mock.calls[0]?.[0]).toContain("create will fail");
  });

  it("prints nothing for an unreadable config, which doctor reports as a failed check", () => {
    const written = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printConfigWarnings({ unreadable: "DATABASE_URL is not set" });
    expect(written).not.toHaveBeenCalled();
  });
});
