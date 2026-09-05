import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectDependency } from "../project-packages";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-project-packages-"));
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ dependencies: { next: "^16.3.0", "@fixture/missing": "workspace:*" } }),
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function install(name: string, manifest: Record<string, unknown>): Promise<void> {
  const dir = path.join(root, "node_modules", ...name.split("/"));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ name, ...manifest }));
}

describe("inspectDependency", () => {
  it("keeps a declared range separate from the resolved manifest version", async () => {
    await install("next", { version: "15.5.9", engines: { node: ">=20" } });
    await expect(inspectDependency(root, "next")).resolves.toMatchObject({
      declaration: { section: "dependencies", specifier: "^16.3.0" },
      installed: { version: "15.5.9" },
    });
  });

  it("reports a declared package as unresolved when its manifest is absent", async () => {
    await expect(inspectDependency(root, "@fixture/missing")).resolves.toMatchObject({
      declaration: { section: "dependencies", specifier: "workspace:*" },
      installed: null,
      error: "unresolved",
    });
  });

  it("resolves a hoisted package through the consumer search paths", async () => {
    await install("@flowpanel/kit", { version: "0.1.0" });
    await expect(inspectDependency(root, "@flowpanel/kit")).resolves.toMatchObject({
      installed: { version: "0.1.0" },
    });
  });

  it("sees a package hoisted to the workspace root above the app directory", async () => {
    const app = path.join(root, "apps", "web");
    await fs.mkdir(app, { recursive: true });
    await fs.writeFile(
      path.join(app, "package.json"),
      JSON.stringify({ name: "web", dependencies: { next: "^16.3.0" } }),
    );
    await install("next", { version: "16.3.4" });
    await expect(inspectDependency(app, "next")).resolves.toMatchObject({
      declaration: { section: "dependencies", specifier: "^16.3.0" },
      installed: { version: "16.3.4" },
      error: null,
    });
  });

  it("reports a PnP layout as its own condition, from the project or an ancestor", async () => {
    const app = path.join(root, "apps", "web");
    await fs.mkdir(app, { recursive: true });
    await fs.writeFile(path.join(app, "package.json"), JSON.stringify({ name: "web" }));
    await fs.writeFile(path.join(root, ".pnp.cjs"), "// pnp\n");
    await expect(inspectDependency(app, "next")).resolves.toMatchObject({
      installed: null,
      error: "pnp-only",
    });
  });

  it("reports an invalid installed manifest without treating it as missing", async () => {
    const dir = path.join(root, "node_modules", "next");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "package.json"), "{");
    await expect(inspectDependency(root, "next")).resolves.toMatchObject({
      installed: null,
      error: "invalid-manifest",
    });
  });
});
