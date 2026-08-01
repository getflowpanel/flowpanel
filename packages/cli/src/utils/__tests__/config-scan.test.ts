import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configSourceFiles, findDestructiveWithoutConfirm } from "../config-scan.js";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-cfg-scan-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, contents: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, contents, "utf8");
}

const DESTRUCTIVE_NO_CONFIRM = `export const users = resource(schema.users, {
  rowActions: [
    { id: "purge", label: "Purge", variant: "destructive", run: async () => {} },
  ],
});
`;

const DESTRUCTIVE_WITH_CONFIRM = `export const users = resource(schema.users, {
  rowActions: [
    {
      id: "purge",
      label: "Purge",
      variant: "destructive",
      confirm: { title: "Purge?" },
      run: async () => {},
    },
  ],
});
`;

describe("configSourceFiles", () => {
  it("finds the single-file layout", async () => {
    await write("flowpanel.config.ts", "export default {};\n");
    expect(await configSourceFiles(tmp)).toEqual(["flowpanel.config.ts"]);
  });

  it("finds the decomposed layout the project recommends", async () => {
    await write("src/admin/config/index.ts", "export default {};\n");
    await write("src/admin/config/resources/users.ts", "export const users = {};\n");
    expect((await configSourceFiles(tmp)).sort()).toEqual([
      "src/admin/config/index.ts",
      "src/admin/config/resources/users.ts",
    ]);
  });

  it("skips node_modules and dot-directories", async () => {
    await write("src/admin/node_modules/pkg/index.ts", "export {};\n");
    await write("src/admin/.next/types.ts", "export {};\n");
    await write("src/admin/config.ts", "export {};\n");
    expect(await configSourceFiles(tmp)).toEqual(["src/admin/config.ts"]);
  });

  it("returns nothing when the project has no config", async () => {
    expect(await configSourceFiles(tmp)).toEqual([]);
  });
});

describe("findDestructiveWithoutConfirm", () => {
  it("reports a destructive action in the decomposed layout", async () => {
    await write("src/admin/config/resources/users.ts", DESTRUCTIVE_NO_CONFIRM);
    expect(await findDestructiveWithoutConfirm(tmp)).toEqual([
      "src/admin/config/resources/users.ts:3",
    ]);
  });

  it("stays quiet when the action has a confirm", async () => {
    await write("src/admin/config/resources/users.ts", DESTRUCTIVE_WITH_CONFIRM);
    expect(await findDestructiveWithoutConfirm(tmp)).toEqual([]);
  });

  it("still reports the single-file layout", async () => {
    await write("flowpanel.config.ts", DESTRUCTIVE_NO_CONFIRM);
    expect(await findDestructiveWithoutConfirm(tmp)).toEqual(["flowpanel.config.ts:3"]);
  });
});
