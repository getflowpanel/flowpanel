import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function run(binary, args, { cwd, env }) {
  try {
    return execFileSync(binary, args, {
      cwd,
      env,
      encoding: "utf8",
      timeout: 600_000,
      killSignal: "SIGKILL",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `${binary} ${args.join(" ")} failed (${error.code ?? error.status ?? error.signal ?? "unknown"})\n${String(error.stdout ?? "")}\n${String(error.stderr ?? "")}`,
    );
  }
}

export function writer(base) {
  return async (file, content) => {
    const target = path.join(base, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
}

/**
 * Packs every public workspace package into `sandbox`; returns name → `file:` tarball spec.
 * Declare `@flowpanel/cli` and `@flowpanel/kit` with their specs before `init`: overrides alone let init's `add @flowpanel/kit@~x` fetch the registry release.
 */
export async function packWorkspace(sandbox, env) {
  const tarballs = {};
  for (const directory of await readdir(path.join(root, "packages"))) {
    const pkgDir = path.join(root, "packages", directory);
    const pkg = JSON.parse(await readFile(path.join(pkgDir, "package.json"), "utf8"));
    if (pkg.private) continue;
    run("pnpm", ["pack", "--pack-destination", sandbox], { cwd: pkgDir, env });
    tarballs[pkg.name] =
      `file:${path.join(sandbox, `${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`)}`;
  }
  return tarballs;
}

async function digests(directory, prefix = "") {
  const out = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      for (const [file, digest] of await digests(path.join(directory, entry.name), relative)) {
        out.set(file, digest);
      }
    } else if (entry.isFile()) {
      const content = await readFile(path.join(directory, entry.name));
      out.set(relative, createHash("sha256").update(content).digest("hex"));
    }
  }
  return out;
}

/** Fails unless `node_modules/@flowpanel` holds exactly `names`, each with the files of its packed tarball. */
export async function assertInstalledFromTarballs(consumer, tarballs, names) {
  const installedScope = (await readdir(path.join(consumer, "node_modules/@flowpanel"))).sort();
  const expected = names.map((name) => name.replace("@flowpanel/", "")).sort();
  if (installedScope.join() !== expected.join()) {
    throw new Error(
      `node_modules/@flowpanel holds ${installedScope.join(", ")}; expected only ${expected.join(", ")}`,
    );
  }
  for (const name of names) {
    const unpacked = await mkdtemp(path.join(path.dirname(consumer), "unpacked-"));
    try {
      execFileSync("tar", ["-xzf", tarballs[name].replace(/^file:/, ""), "-C", unpacked]);
      const packed = await digests(path.join(unpacked, "package"));
      const installed = await digests(path.join(consumer, "node_modules", name));
      for (const [file, digest] of packed) {
        if (installed.get(file) !== digest) {
          throw new Error(
            `${name} in node_modules is not the packed tarball (${file} differs); declare it as a file: dependency before init`,
          );
        }
      }
    } finally {
      await rm(unpacked, { recursive: true, force: true });
    }
  }
}

export async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

/** Runs `next <command>` on a free port and resolves once Next prints "Ready in". */
export async function startNext(cwd, command, extraArgs, env) {
  const port = await freePort();
  const child = spawn(
    process.execPath,
    [
      path.join(cwd, "node_modules/next/dist/bin/next"),
      command,
      ...extraArgs,
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  let childError;
  child.stdout.on("data", (data) => {
    log += data;
  });
  child.stderr.on("data", (data) => {
    log += data;
  });
  const done = new Promise((resolve) => {
    child.once("exit", resolve);
    child.once("error", (error) => {
      childError = error;
      resolve();
    });
  });
  const server = {
    origin: `http://127.0.0.1:${port}`,
    log: () => log,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null || childError) return;
      child.kill("SIGTERM");
      const stopped = await Promise.race([
        done.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 5_000).unref()),
      ]);
      if (stopped) return;
      child.kill("SIGKILL");
      await Promise.race([
        done,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Next did not terminate")), 5_000).unref(),
        ),
      ]);
    },
  };
  const deadline = Date.now() + 120_000;
  while (!log.includes("Ready in")) {
    if (
      childError ||
      child.exitCode !== null ||
      child.signalCode !== null ||
      Date.now() > deadline
    ) {
      await server.stop();
      throw new Error(`Next did not start\n${log}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return server;
}

export function fetchFrom(origin, route, init = {}) {
  return fetch(`${origin}${route}`, { ...init, signal: AbortSignal.timeout(180_000) });
}
