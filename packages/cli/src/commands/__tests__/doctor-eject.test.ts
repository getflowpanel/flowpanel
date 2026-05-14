import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkEjectMarker } from "../doctor.js";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-doctor-eject-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("checkEjectMarker", () => {
  it("returns null when the file does not exist", async () => {
    expect(await checkEjectMarker(tmp, "users")).toBeNull();
  });
  it("returns null when the marker is present", async () => {
    await fs.mkdir(path.join(tmp, "app/admin/users"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "app/admin/users/page.tsx"),
      "// flowpanel: ejected @ 1.0.0 — this file is yours\nexport default () => null;\n",
    );
    expect(await checkEjectMarker(tmp, "users")).toBeNull();
  });
  it("returns a warning when the file exists without the marker", async () => {
    await fs.mkdir(path.join(tmp, "app/admin/users"), { recursive: true });
    await fs.writeFile(path.join(tmp, "app/admin/users/page.tsx"), "export default () => null;\n");
    const w = await checkEjectMarker(tmp, "users");
    expect(w).toMatch(/lacks the eject marker/);
  });
});
