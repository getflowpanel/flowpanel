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
    `import { defineAdmin, resource } from "flowpanel";
import * as schema from "./db/schema";
export default defineAdmin({
  resources: [
    resource(schema.users, { columns: ["email"] }),
    resource(schema.jobs, { columns: ["title"] }),
  ],
});
`,
  );
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("runEject", () => {
  it("ejects a resource end-to-end (writes files + edits config)", async () => {
    await runEject({ cwd: tmp, target: "resource", name: "users", version: "1.0.0-beta.0" });
    const page = await fs.readFile(path.join(tmp, "app/admin/users/page.tsx"), "utf8");
    expect(page).toMatch(/ejected @ 1\.0\.0-beta\.0/);
    const cfg = await fs.readFile(path.join(tmp, "flowpanel.config.ts"), "utf8");
    expect(cfg).toContain("// ejected: app/admin/users");
    expect(cfg).not.toMatch(/resource\(schema\.users,/);
    expect(cfg).toMatch(/resource\(schema\.jobs,/);
  });

  it("rejects unknown target", async () => {
    await expect(
      runEject({ cwd: tmp, target: "ghost" as never, name: "users", version: "1.0.0-beta.0" }),
    ).rejects.toThrow(/Unknown eject target/);
  });

  it("rejects dashboard / layout (M4a ships resource only)", async () => {
    await expect(
      runEject({ cwd: tmp, target: "dashboard", name: "monitoring", version: "1.0.0-beta.0" }),
    ).rejects.toThrow(/not yet implemented/);
  });
});
