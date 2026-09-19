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

describe("printing them", () => {
  it("writes one warning line each and nothing when there are none", () => {
    const written = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printConfigWarnings({ warnings: [] });
    expect(written).not.toHaveBeenCalled();
    printConfigWarnings({ warnings: ["create will fail", "and so will this"] });
    expect(written).toHaveBeenCalledTimes(2);
    expect(written.mock.calls[0]?.[0]).toContain("create will fail");
  });

  it("says out loud that the warnings were not checked", () => {
    const written = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printConfigWarnings({ unreadable: "DATABASE_URL is not set" });
    expect(written).toHaveBeenCalledTimes(1);
    expect(written.mock.calls[0]?.[0]).toContain(
      "flowpanel.config.ts could not be evaluated: DATABASE_URL is not set; config warnings skipped",
    );
  });
});
