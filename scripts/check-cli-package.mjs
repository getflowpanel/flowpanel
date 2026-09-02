import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = await mkdtemp(path.join(tmpdir(), "flowpanel-cli-package-"));
const command = (name) => (process.platform === "win32" ? `${name}.cmd` : name);

/** A command reported its own failure already; the caller only sets the status. */
class CommandFailed extends Error {}

/**
 * Node refuses to spawn a `.cmd` without a shell. Under one, quote only what
 * has to be quoted: a quoted bare name leaves `%~dp0` pointing at the current
 * directory, so the shim looks for pnpm next to the repo instead of itself.
 */
function exec(file, args, options) {
  if (!file.endsWith(".cmd")) return execFileSync(file, args, options);
  const quote = (value) => (/[\s"]/.test(value) ? `"${value}"` : value);
  return execFileSync(quote(file), args.map(quote), { ...options, shell: true });
}

/**
 * `stdio: "pipe"` hands a failure back with Buffer stdout/stderr, which node's
 * default printer renders as thousands of byte codes. Report what the command
 * actually said instead.
 */
function run(file, args, options) {
  try {
    return exec(file, args, options);
  } catch (error) {
    const why = error.status ?? error.code ?? error.message;
    console.error(`✗ ${file} ${args.join(" ")} failed with ${why}`);
    for (const stream of ["stdout", "stderr"]) {
      const said = String(error[stream] ?? "").trim();
      if (said) console.error(`── ${stream} ──\n${said}`);
    }
    throw new CommandFailed(`${file} failed`);
  }
}

/** The clean-room install is the one step that reaches the network. */
function runOnceMore(file, args, options) {
  try {
    return exec(file, args, options);
  } catch {
    console.error(`↻ ${file} ${args.join(" ")} failed; retrying once before failing the check`);
    return run(file, args, options);
  }
}

try {
  run(command("pnpm"), ["--filter", "@flowpanel/cli", "pack", "--pack-destination", sandbox], {
    cwd: root,
    stdio: "pipe",
  });

  const tarballs = (await readdir(sandbox)).filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1, `expected one CLI tarball, found ${tarballs.length}`);

  const consumer = path.join(sandbox, "consumer");
  await mkdir(consumer);
  await writeFile(
    path.join(consumer, "package.json"),
    `${JSON.stringify({ name: "flowpanel-cli-consumer", private: true }, null, 2)}\n`,
  );

  runOnceMore(
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
  const help = run(binary, ["--help"], { cwd: consumer, encoding: "utf8" });
  assert.match(help, /Usage: flowpanel/);
  for (const subcommand of ["init", "dev", "new", "migrate", "doctor", "eject"]) {
    assert.match(help, new RegExp(`\\b${subcommand}\\b`));
  }

  console.log("✓ packed CLI installs into a clean npm project and exposes every command");
} catch (error) {
  if (!(error instanceof CommandFailed)) throw error;
  process.exitCode = 1;
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
