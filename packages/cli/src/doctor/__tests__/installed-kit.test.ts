import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { countKitInstances } from "../probes";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-active-kit-"));
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

describe("active kit installations", () => {
  it("ignores stale pnpm entries and deduplicates real paths without loading packages", async () => {
    await pkg(".", "host", { "@flowpanel/kit": "1", "host-plugin": "1" });
    await pkg(
      "node_modules/.pnpm/@flowpanel+kit@old/node_modules/@flowpanel/kit",
      "@flowpanel/kit",
    );
    const kit = "node_modules/.pnpm/@flowpanel+kit@active/node_modules/@flowpanel/kit";
    await pkg(kit, "@flowpanel/kit");
    await pkg("node_modules/host-plugin", "host-plugin", { "@flowpanel/kit": "1" });
    await link("node_modules/@flowpanel/kit", kit);
    await link("node_modules/host-plugin/node_modules/@flowpanel/kit", kit);
    expect(await countKitInstances(root)).toBe(1);
  });

  it("finds a genuinely different kit reached through a third-party plugin", async () => {
    await pkg(".", "host", { "@flowpanel/kit": "1", "host-plugin": "1" });
    await pkg("node_modules/@flowpanel/kit", "@flowpanel/kit");
    await pkg("node_modules/host-plugin", "host-plugin", { "@flowpanel/kit": "2" });
    await pkg("node_modules/host-plugin/node_modules/@flowpanel/kit", "@flowpanel/kit");
    expect(await countKitInstances(root)).toBe(2);
  });

  it("follows pnpm package-local peers instead of assuming root hoisting", async () => {
    await pkg(".", "host", { "host-plugin": "1" });
    const plugin = "node_modules/.pnpm/plugin/node_modules/host-plugin";
    await pkg(plugin, "host-plugin");
    await fs.writeFile(
      path.join(root, plugin, "package.json"),
      JSON.stringify({ name: "host-plugin", peerDependencies: { "@flowpanel/kit": "1" } }),
    );
    await pkg("node_modules/.pnpm/plugin/node_modules/@flowpanel/kit", "@flowpanel/kit");
    await link("node_modules/host-plugin", plugin);
    expect(await countKitInstances(root)).toBe(1);
  });

  it("skips an uninstalled project", async () => {
    await pkg(".", "host", { "@flowpanel/kit": "1" });
    expect(await countKitInstances(root)).toBeNull();
  });
});
