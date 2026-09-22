import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Build workspace packages before running. The consumer uses package tarballs,
// never workspace symlinks, and does not need a database or host credentials.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pm = process.argv[2] ?? "pnpm";
const tailwindMode = process.argv[3] ?? "none";
assert.ok(
  ["npm", "pnpm"].includes(pm) && ["none", "4"].includes(tailwindMode),
  "Usage: check-next-onboarding.mjs [npm|pnpm] [none|4]",
);
const hasTailwind = tailwindMode === "4";
const sandbox = await mkdtemp(path.join(tmpdir(), `flowpanel-next-${pm}-tw${tailwindMode}-`));
const consumer = path.join(sandbox, "consumer");
const env = {
  ...process.env,
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: "postgres://fixture:fixture@127.0.0.1:1/unused",
  npm_config_cache: path.join(sandbox, "npm-cache"),
  npm_config_fetch_retries: "0",
  npm_config_fetch_timeout: "15000",
};
let child;
let childDone;
let childError;
let serverLog = "";
function run(binary, args, cwd = consumer) {
  try {
    return execFileSync(binary, args, {
      cwd,
      env,
      encoding: "utf8",
      timeout: 360_000,
      killSignal: "SIGKILL",
    });
  } catch (error) {
    throw new Error(
      `${binary} ${args.join(" ")} failed (${error.code ?? error.status ?? error.signal ?? "unknown"})\n${String(error.stdout ?? "")}\n${String(error.stderr ?? "")}`,
    );
  }
}
async function write(file, content) {
  const target = path.join(consumer, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}
async function exists(file) {
  return access(file, constants.F_OK)
    .then(() => true)
    .catch(() => false);
}
async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

try {
  await mkdir(consumer);
  const overrides = {};
  for (const directory of await readdir(path.join(root, "packages"))) {
    const pkgDir = path.join(root, "packages", directory);
    const pkg = JSON.parse(await readFile(path.join(pkgDir, "package.json"), "utf8"));
    if (pkg.private) continue;
    run("pnpm", ["pack", "--pack-destination", sandbox], pkgDir);
    overrides[pkg.name] =
      `file:${path.join(sandbox, `${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`)}`;
  }
  await write(
    "package.json",
    JSON.stringify(
      {
        name: "flowpanel-onboarding-fixture",
        private: true,
        type: "module",
        dependencies: {
          "@flowpanel/kit": overrides["@flowpanel/kit"],
          "@flowpanel/cli": overrides["@flowpanel/cli"],
          next: "16.3.1",
          react: "19.2.0",
          "react-dom": "19.2.0",
          "drizzle-orm": "0.45.2",
          pg: "8.16.3",
          zod: "4.3.6",
        },
        devDependencies: {
          typescript: "5.9.3",
          "@types/node": "22.19.7",
          "@types/react": "19.2.14",
          "@types/pg": "8.16.0",
          ...(hasTailwind
            ? {
                tailwindcss: "4.3.0",
                "@tailwindcss/postcss": "4.3.0",
              }
            : {}),
        },
        ...(pm === "pnpm" ? { pnpm: { overrides } } : { overrides }),
      },
      null,
      2,
    ),
  );
  await write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "dom.iterable", "esnext"],
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          resolveJsonModule: true,
          paths: { "@/*": ["./src/*"] },
          plugins: [{ name: "next" }],
        },
        include: ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );
  const layout =
    'import type { ReactNode } from "react"; export default function Layout({ children, modal }: { children: ReactNode; modal: ReactNode }) { return <html lang="en"><body>{children}{modal}</body></html>; }';
  const legacy = "export default function Page() { return <h1>Existing host admin</h1>; }";
  await write("src/app/layout.tsx", layout);
  await write(
    "src/app/page.tsx",
    "export default function Page() { return <h1>Existing host home</h1>; }",
  );
  await write("src/app/(dashboard)/admin/page.tsx", legacy);
  await write(
    "src/app/[locale]/(marketing)/page.tsx",
    "export default function Page() { return <h1>Existing locale page</h1>; }",
  );
  await write(
    "src/app/order/[id]/page.tsx",
    "export default function Page() { return <h1>Existing order page</h1>; }",
  );
  await write("src/app/@modal/default.tsx", "export default function Modal() { return null; }");
  await write(
    "src/app/@modal/(.)order/[id]/page.tsx",
    "export default function Modal() { return <h2>Order modal</h2>; }",
  );
  await write(
    "src/shared/lib/db/index.ts",
    'import { drizzle } from "drizzle-orm/node-postgres"; import { Pool } from "pg"; export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));',
  );
  await write(
    "src/shared/lib/db/schema/index.ts",
    'import { pgTable, text } from "drizzle-orm/pg-core"; export const users = pgTable("users", { id: text("id").primaryKey() });',
  );
  if (hasTailwind) {
    await write(
      "postcss.config.mjs",
      'export default { plugins: { "@tailwindcss/postcss": {} } };',
    );
  }
  // No workspace inheritance: pnpm must exercise its isolated package layout.
  if (pm === "pnpm") await write("pnpm-workspace.yaml", "packages: []\n");
  console.log(`Installing packed packages with ${pm}; Tailwind ${tailwindMode} in ${consumer}`);
  run(pm, ["install", "--ignore-scripts", ...(pm === "npm" ? ["--no-audit", "--no-fund"] : [])]);
  console.log("Installed tarballs; checking generated files and TypeScript");
  const cli = path.join(consumer, "node_modules/@flowpanel/cli/dist/index.mjs");
  const args = [cli, "init", "--yes", "--json", "--dev-auth"];
  const preview = JSON.parse(run(process.execPath, [...args, "--dry-run"]));
  assert.equal(preview.applied, false);
  await assert.rejects(readFile(path.join(consumer, "flowpanel.config.ts")));
  const initialized = JSON.parse(run(process.execPath, args));
  assert.equal(initialized.adminPath, "/flowpanel");
  assert.equal(initialized.authentication, "development");
  assert.equal(await readFile(path.join(consumer, "src/app/layout.tsx"), "utf8"), layout);
  assert.equal(
    await readFile(path.join(consumer, "src/app/(dashboard)/admin/page.tsx"), "utf8"),
    legacy,
  );
  const repeated = JSON.parse(run(process.execPath, args));
  assert.ok(repeated.plan.operations.every((operation) => operation.kind === "skip"));
  const generatedCss = await readFile(path.join(consumer, "src/styles/admin.css"), "utf8");
  assert.match(generatedCss, /@import "@flowpanel\/kit\/styles\/admin\.css";/);
  assert.doesNotMatch(generatedCss, /^@(tailwind|source|theme)\b/m);
  const requireConsumer = createRequire(path.join(consumer, "package.json"));
  const kitCss = requireConsumer.resolve("@flowpanel/kit/styles/admin.css");
  assert.ok(await exists(kitCss), `kit stylesheet did not resolve: ${kitCss}`);
  assert.match(await readFile(kitCss, "utf8"), /data-flowpanel-root/);
  if (!hasTailwind) {
    assert.equal(await exists(path.join(consumer, "postcss.config.mjs")), false);
    assert.equal(await exists(path.join(consumer, "node_modules/tailwindcss")), false);
    assert.equal(await exists(path.join(consumer, "node_modules/@tailwindcss/postcss")), false);
  }
  run(process.execPath, [path.join(consumer, "node_modules/typescript/bin/tsc"), "--noEmit"]);
  const port = await freePort();
  console.log("Starting Next and requesting host/admin routes");
  child = spawn(
    process.execPath,
    [
      path.join(consumer, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: consumer, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", (data) => {
    serverLog += data;
  });
  child.stderr.on("data", (data) => {
    serverLog += data;
  });
  childDone = new Promise((resolve) => {
    child.once("exit", resolve);
    child.once("error", (error) => {
      childError = error;
      resolve();
    });
  });
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  while (!serverLog.includes("Ready in")) {
    if (childError || child.exitCode !== null || child.signalCode !== null || Date.now() > deadline)
      throw new Error(`Next did not start\n${serverLog}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  let adminHtml = "";
  for (const [route, content] of [
    ["/", "Existing host home"],
    ["/admin", "Existing host admin"],
    ["/ru", "Existing locale page"],
    ["/order/1", "Existing order page"],
    ["/flowpanel", "FlowPanel is mounted and working"],
  ]) {
    const response = await fetch(`${origin}${route}`, { signal: AbortSignal.timeout(180_000) });
    assert.equal(response.status, 200, `${route}\n${serverLog}`);
    const html = await response.text();
    assert.ok(html.includes(content), `${route} did not render expected content\n${serverLog}`);
    if (route === "/flowpanel") adminHtml = html;
  }
  const stylesheetUrls = [
    ...adminHtml.matchAll(/<link\b[^>]*\bhref="([^"]+\.css[^"]*)"[^>]*>/g),
  ].map((match) => match[1].replaceAll("&amp;", "&"));
  assert.ok(stylesheetUrls.length > 0, `FlowPanel route served no stylesheet\n${serverLog}`);
  const servedCss = await Promise.all(
    stylesheetUrls.map(async (href) => {
      const response = await fetch(new URL(href, origin), { signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, 200, `Stylesheet ${href} did not load\n${serverLog}`);
      return response.text();
    }),
  );
  assert.ok(
    servedCss.some((css) => css.includes("--fp-bg-1") && css.includes("data-flowpanel-root")),
    `FlowPanel stylesheet was not served from the packed kit export\n${serverLog}`,
  );
  console.log(
    `✓ ${pm}, Tailwind ${tailwindMode}: dry-run, init, resolved packed CSS, TypeScript, host routes, and served admin CSS passed`,
  );
} catch (error) {
  if (serverLog) console.error(serverLog);
  throw error;
} finally {
  if (child && child.exitCode === null && child.signalCode === null && !childError) {
    child.kill("SIGTERM");
    const terminated = await Promise.race([
      childDone.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000).unref()),
    ]);
    if (!terminated) {
      child.kill("SIGKILL");
      await Promise.race([
        childDone,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Next did not terminate")), 5_000).unref(),
        ),
      ]);
    }
  }
  if (process.env.FLOWPANEL_KEEP_FIXTURE === "1") {
    await writeFile(path.join(sandbox, "server.log"), serverLog);
    console.log(`Kept fixture: ${consumer}`);
  } else await rm(sandbox, { recursive: true, force: true });
}
