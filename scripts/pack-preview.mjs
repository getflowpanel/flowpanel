import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A local integration artifact, never a registry publication. Build tracked source
// from a commit; installed external build dependencies come from this checkout.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [version, destination, ref = "HEAD"] = process.argv.slice(2);
assert.match(
  version ?? "",
  /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/,
  "Pass an explicit prerelease version",
);
assert.ok(destination, "Usage: node scripts/pack-preview.mjs VERSION OUTPUT_DIRECTORY [COMMIT]");
const output = path.resolve(destination);
assert.ok(
  !output.startsWith(`${root}${path.sep}`),
  "Keep preview artifacts outside the source checkout",
);
const stage = await mkdtemp(path.join(tmpdir(), "flowpanel-preview-build-"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (binary, args, cwd = root, options = {}) =>
  execFileSync(binary, args, {
    cwd,
    encoding: "utf8",
    timeout: 360_000,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
const json = async (file) => JSON.parse(await readFile(file, "utf8"));

try {
  // mkdir fails if output already exists: never overwrite a vendored preview.
  await mkdir(output);
  const commit = run("git", ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  const archive = run("git", ["archive", commit], root, { encoding: "buffer" });
  run("tar", ["-x", "-C", stage], root, { input: archive });
  assert.equal(
    sha256(await readFile(path.join(stage, "pnpm-lock.yaml"))),
    sha256(await readFile(path.join(root, "pnpm-lock.yaml"))),
    "Install the selected commit's lockfile before building its preview",
  );
  const packages = [];
  for (const directory of await readdir(path.join(stage, "packages"))) {
    const folder = path.join(stage, "packages", directory);
    const manifest = await json(path.join(folder, "package.json"));
    if (!manifest.private) packages.push({ directory, folder, manifest });
  }
  const names = new Set(packages.map((p) => p.manifest.name));
  await symlink(path.join(root, "node_modules"), path.join(stage, "node_modules"), "dir");
  for (const pkg of packages) {
    const modules = path.join(pkg.folder, "node_modules");
    await mkdir(path.join(modules, "@flowpanel"), { recursive: true });
    // Internal imports must resolve to staged packages, not old workspace dist.
    for (const dependency of packages) {
      await symlink(dependency.folder, path.join(modules, dependency.manifest.name), "dir");
    }
    const installed = path.join(root, "packages", pkg.directory, "node_modules");
    for (const entry of await readdir(installed)) {
      if (entry === "@flowpanel") continue;
      await symlink(await realpath(path.join(installed, entry)), path.join(modules, entry), "dir");
    }
    pkg.manifest.version = version;
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const name of Object.keys(pkg.manifest[field] ?? {})) {
        if (names.has(name)) pkg.manifest[field][name] = version;
      }
    }
    await writeFile(
      path.join(pkg.folder, "package.json"),
      `${JSON.stringify(pkg.manifest, null, 2)}\n`,
    );
  }
  const built = new Set();
  while (built.size < packages.length) {
    const ready = packages.filter(
      (pkg) =>
        !built.has(pkg.manifest.name) &&
        Object.keys({ ...pkg.manifest.dependencies, ...pkg.manifest.devDependencies })
          .filter((name) => names.has(name))
          .every((name) => built.has(name)),
    );
    assert.ok(ready.length, "Internal build dependency cycle");
    for (const pkg of ready) {
      assert.equal(
        pkg.manifest.scripts.build,
        "tsup",
        `Unsupported build command in ${pkg.manifest.name}`,
      );
      console.log(`Building ${pkg.manifest.name}@${version}`);
      const tsup = await realpath(path.join(pkg.folder, "node_modules/tsup"));
      const bin = (await json(path.join(tsup, "package.json"))).bin.tsup;
      run(process.execPath, [path.join(tsup, bin)], pkg.folder);
      built.add(pkg.manifest.name);
    }
  }
  const cli = packages.find((pkg) => pkg.manifest.name === "@flowpanel/cli");
  assert.equal(
    run(process.execPath, [path.join(cli.folder, "dist/index.mjs"), "--version"], stage).trim(),
    version,
  );
  const artifacts = [];
  for (const pkg of packages) {
    run("pnpm", ["pack", "--pack-destination", output], pkg.folder);
    const filename = `${pkg.manifest.name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
    const bytes = await readFile(path.join(output, filename));
    artifacts.push({
      name: pkg.manifest.name,
      version,
      file: filename,
      sha256: sha256(bytes),
      bytes: bytes.length,
    });
  }
  await writeFile(
    path.join(output, "manifest.json"),
    `${JSON.stringify(
      {
        format: 1,
        kind: "local-preview",
        sourceCommit: commit,
        sourceArchiveSha256: sha256(archive),
        builderSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
        lockfileSha256: sha256(await readFile(path.join(stage, "pnpm-lock.yaml"))),
        toolchain: { node: process.version, pnpm: run("pnpm", ["--version"]).trim() },
        build: "tsup per package in dependency order, with staged prerelease metadata",
        artifacts,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Packed ${artifacts.length} immutable local previews in ${output}`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
