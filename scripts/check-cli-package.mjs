import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = await mkdtemp(path.join(tmpdir(), "flowpanel-cli-package-"));
const command = (name) => (process.platform === "win32" ? `${name}.cmd` : name);

try {
  execFileSync(
    command("pnpm"),
    ["--filter", "@flowpanel/cli", "pack", "--pack-destination", sandbox],
    { cwd: root, stdio: "pipe" },
  );

  const tarballs = (await readdir(sandbox)).filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1, `expected one CLI tarball, found ${tarballs.length}`);

  const consumer = path.join(sandbox, "consumer");
  await mkdir(consumer);
  await writeFile(
    path.join(consumer, "package.json"),
    `${JSON.stringify({ name: "flowpanel-cli-consumer", private: true }, null, 2)}\n`,
  );

  execFileSync(
    command("npm"),
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", path.join(sandbox, tarballs[0])],
    {
      cwd: consumer,
      stdio: "pipe",
      // A release check must not depend on the ownership or contents of the
      // developer's global npm cache. Keep the entire clean-room install in
      // the temporary sandbox that is removed below.
      env: { ...process.env, npm_config_cache: path.join(sandbox, "npm-cache") },
    },
  );

  const binary = path.join(
    consumer,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "flowpanel.cmd" : "flowpanel",
  );
  const help = execFileSync(binary, ["--help"], { cwd: consumer, encoding: "utf8" });
  assert.match(help, /Usage: flowpanel/);
  for (const subcommand of ["init", "dev", "new", "migrate", "doctor", "eject"]) {
    assert.match(help, new RegExp(`\\b${subcommand}\\b`));
  }

  console.log("✓ packed CLI installs into a clean npm project and exposes every command");
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
