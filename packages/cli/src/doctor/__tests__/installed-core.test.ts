import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { countCoreInstances } from "../probes";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-active-core-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function pkg(dir: string, name: string, dependencies: Record<string, string> = {}) {
  const dest = path.join(root, dir);
  await fs.mkdir(dest, { recursive: true });
  await fs.writeFile(
    path.join(dest, "package.json"),
    JSON.stringify({ name, version: "1.0.0", dependencies }),
  );
  await fs.writeFile(
    path.join(dest, "index.js"),
    'throw new Error("doctor must not execute packages");',
  );
  return dest;
}
async function link(from: string, target: string) {
  await fs.mkdir(path.dirname(path.join(root, from)), { recursive: true });
  await fs.symlink(path.join(root, target), path.join(root, from), "dir");
}

describe("active core installations", () => {
  it("ignores stale pnpm entries and deduplicates real paths without loading packages", async () => {
    await pkg(".", "host", { "@flowpanel/kit": "1", "@flowpanel/core": "1" });
    await pkg(
      "node_modules/.pnpm/@flowpanel+core@old/node_modules/@flowpanel/core",
      "@flowpanel/core",
    );
    const core = "node_modules/.pnpm/@flowpanel+core@active/node_modules/@flowpanel/core";
    await pkg(core, "@flowpanel/core");
    await pkg("node_modules/@flowpanel/kit", "@flowpanel/kit", { "@flowpanel/core": "1" });
    await link("node_modules/@flowpanel/core", core);
    await link("node_modules/@flowpanel/kit/node_modules/@flowpanel/core", core);
    expect(await countCoreInstances(root)).toBe(1);
  });

  it("finds a genuinely different core reached through a third-party plugin", async () => {
    await pkg(".", "host", { "@flowpanel/core": "1", "host-plugin": "1" });
    await pkg("node_modules/@flowpanel/core", "@flowpanel/core");
    await pkg("node_modules/host-plugin", "host-plugin", { "@flowpanel/core": "2" });
    await pkg("node_modules/host-plugin/node_modules/@flowpanel/core", "@flowpanel/core");
    expect(await countCoreInstances(root)).toBe(2);
  });

  it("follows pnpm package-local peers instead of assuming root hoisting", async () => {
    await pkg(".", "host", { "@flowpanel/kit": "1" });
    const kit = "node_modules/.pnpm/kit/node_modules/@flowpanel/kit";
    await pkg(kit, "@flowpanel/kit");
    await fs.writeFile(
      path.join(root, kit, "package.json"),
      JSON.stringify({ name: "@flowpanel/kit", peerDependencies: { "@flowpanel/core": "1" } }),
    );
    await pkg("node_modules/.pnpm/kit/node_modules/@flowpanel/core", "@flowpanel/core");
    await link("node_modules/@flowpanel/kit", kit);
    expect(await countCoreInstances(root)).toBe(1);
  });

  it("skips an uninstalled project", async () => {
    await pkg(".", "host", { "@flowpanel/core": "1" });
    expect(await countCoreInstances(root)).toBeNull();
  });
});
