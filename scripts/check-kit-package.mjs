import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCommonJsScript } from "./kit-package-cjs.mjs";

// The packed kit, installed alone into a clean project, loads and type-checks every subpath.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = await mkdtemp(path.join(tmpdir(), "flowpanel-kit-package-"));
const env = { ...process.env, npm_config_cache: path.join(sandbox, "npm-cache") };

class CommandFailed extends Error {
  constructor(command, error) {
    super(`${command} failed\n${String(error.stdout ?? "")}\n${String(error.stderr ?? "")}`);
    this.output = `${String(error.stdout ?? "")}${String(error.stderr ?? "")}`;
  }
}

const run = (binary, args, cwd, extra = {}) => {
  try {
    return execFileSync(binary, args, {
      cwd,
      env: { ...env, ...extra },
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new CommandFailed(`${binary} ${args.join(" ")}`, error);
  }
};

const REQUIRED_PEERS = { next: "16.4.0", react: "19.3.0", "react-dom": "19.3.0", zod: "4.6.5" };
const OPTIONAL_PEERS = {
  "@axe-core/playwright": "4.13.0",
  "@bull-board/api": "9.10.4",
  "@bull-board/express": "9.10.4",
  "@playwright/test": "1.63.0",
  bullmq: "6.3.11",
  "drizzle-orm": "0.45.3",
  express: "5.2.1",
  ioredis: "6.0.0",
};
const DEV = {
  "@types/node": "22.20.5",
  "@types/react": "19.3.0",
  tsx: "4.23.15",
  typescript: "5.9.3",
};

// Optional peers a subpath's declarations may load; any other optional peer means it leaks.
const OWN_PEERS = {
  "./bullmq": ["bullmq"],
  "./bullmq/board": ["bullmq", "express", "@bull-board/api", "@bull-board/express"],
  "./drizzle": ["drizzle-orm"],
  "./test": ["@playwright/test", "@axe-core/playwright"],
};

// Plain Node, unlike Next's bundler, does not resolve `next/navigation` without an extension.
const LOADER = `
export async function resolve(specifier, context, next) {
  if (process.env.FP_FORBID_PLAYWRIGHT && /^@(playwright|axe-core)\\//.test(specifier)) {
    throw new Error(\`\${context.parentURL} loaded \${specifier}\`);
  }
  try {
    return await next(specifier, context);
  } catch (error) {
    if (/^next\\/[^.]+$/.test(specifier)) return next(\`\${specifier}.js\`, context);
    throw error;
  }
}
`;

async function consumerWith(name, tarball, dependencies) {
  const dir = path.join(sandbox, name);
  await mkdir(dir);
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({
      name: `flowpanel-kit-${name}`,
      private: true,
      type: "module",
      dependencies: { "@flowpanel/kit": `file:${tarball}`, ...dependencies },
      devDependencies: DEV,
    }),
  );
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], dir);
  assert.deepEqual(
    await readdir(path.join(dir, "node_modules/@flowpanel")),
    ["kit"],
    "the install pulled in another @flowpanel package",
  );
  return dir;
}

async function typecheck(dir, file, source, compilerOptions) {
  await writeFile(path.join(dir, file), source);
  const config = `tsconfig.${file}.json`;
  await writeFile(
    path.join(dir, config),
    JSON.stringify({
      compilerOptions: {
        target: "es2022",
        strict: true,
        noEmit: true,
        jsx: "react-jsx",
        lib: ["es2023", "dom", "dom.iterable"],
        types: ["node", "react"],
        ...compilerOptions,
      },
      files: [file],
    }),
  );
  try {
    run(process.execPath, [path.join(dir, "node_modules/typescript/bin/tsc"), "-p", config], dir);
  } catch (error) {
    console.error(error.output ?? String(error));
    throw new Error(`tsc -p ${config} failed in ${path.basename(dir)}`);
  }
}

/** The bare packages a subpath's declarations reach, following the kit's own relative imports. */
function declarationPackages(dir, subpath) {
  const ts = createRequire(path.join(dir, "package.json"))("typescript");
  const kit = path.join(dir, "node_modules/@flowpanel/kit");
  const manifest = JSON.parse(ts.sys.readFile(path.join(kit, "package.json")));
  const entry = manifest.exports[subpath];
  const types = entry.types ?? entry.import?.types;
  const seen = new Set();
  const packages = new Set();
  const queue = [path.join(kit, types)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const { importedFiles } = ts.preProcessFile(ts.sys.readFile(file), true, true);
    for (const { fileName } of importedFiles) {
      if (fileName.startsWith(".")) {
        const base = path.resolve(path.dirname(file), fileName);
        const target = [base.replace(/\.([cm]?)js$/, ".d.$1ts"), `${base}.d.ts`].find((c) =>
          ts.sys.fileExists(c),
        );
        assert.ok(target, `${file} imports ${fileName}, which is not shipped`);
        queue.push(target);
      } else {
        const parts = fileName.split("/");
        packages.add(fileName.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
      }
    }
  }
  return packages;
}

const probeFor = (specifiers) =>
  [
    ...specifiers.map((specifier, index) => `import * as entry${index} from "${specifier}";`),
    `export const all = [${specifiers.map((_, index) => `entry${index}`).join(", ")}];`,
    "",
  ].join("\n");

try {
  run("pnpm", ["--filter", "@flowpanel/kit", "pack", "--pack-destination", sandbox], root);
  const [file, ...others] = (await readdir(sandbox)).filter((name) => name.endsWith(".tgz"));
  assert.ok(file && others.length === 0, "expected one kit tarball");
  const tarball = path.join(sandbox, file);
  const exportsMap = JSON.parse(
    await readFile(path.join(root, "packages/flowpanel/package.json"), "utf8"),
  ).exports;
  const subpaths = Object.keys(exportsMap).filter(
    (subpath) => !subpath.endsWith(".css") && subpath !== "./package.json",
  );
  const styles = Object.keys(exportsMap).filter((subpath) => subpath.endsWith(".css"));

  const full = await consumerWith("full", tarball, { ...REQUIRED_PEERS, ...OPTIONAL_PEERS });
  const installed = JSON.parse(
    await readFile(path.join(full, "node_modules/@flowpanel/kit/package.json"), "utf8"),
  );
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const internal = Object.keys(installed[field] ?? {}).filter((name) =>
      name.startsWith("@flowpanel/"),
    );
    assert.deepEqual(internal, [], `the packed kit's ${field} name ${internal.join(", ")}`);
  }

  await writeFile(path.join(full, "loader.mjs"), LOADER);
  await writeFile(
    path.join(full, "register.mjs"),
    'import { register } from "node:module";\nregister("./loader.mjs", import.meta.url);\n',
  );
  for (const subpath of subpaths) {
    const specifier = `@flowpanel/kit${subpath.slice(1)}`;
    const forbid = subpath.startsWith("./test") ? {} : { FP_FORBID_PLAYWRIGHT: "1" };
    const count = run(
      process.execPath,
      [
        "--import",
        "./register.mjs",
        "--input-type=module",
        "-e",
        `const m = await import(${JSON.stringify(specifier)}); console.log(Object.keys(m).length);`,
      ],
      full,
      forbid,
    ).trim();
    assert.ok(Number(count) > 0, `${specifier} exports nothing`);
    console.log(`  import ${specifier}: ${count} exports`);
  }
  for (const subpath of styles) {
    const specifier = `@flowpanel/kit${subpath.slice(1)}`;
    run(process.execPath, ["-e", `require.resolve(${JSON.stringify(specifier)})`], full);
    console.log(`  resolve ${specifier}`);
  }
  const required = run(
    process.execPath,
    ["-e", 'console.log(typeof require("@flowpanel/kit/test").smokeAdmin)'],
    full,
  ).trim();
  assert.equal(required, "function", "require(@flowpanel/kit/test) has no smokeAdmin");
  console.log("  require @flowpanel/kit/test: smokeAdmin");

  const worker = path.join(full, "cjs-worker");
  await mkdir(worker);
  await writeFile(path.join(worker, "package.json"), JSON.stringify({ private: true }));
  await writeFile(
    path.join(worker, "admin-events.js"),
    [
      'const { createPublisher } = require("@flowpanel/kit/publish");',
      "const sent = [];",
      "const client = { publish: async (channel, message) => sent.push([channel, message]), on() {} };",
      'const events = createPublisher({ redis: client, keyPrefix: "app" });',
      'events.resource("orders", { id: 1 }).then(() => console.log(JSON.stringify(sent)));',
      "",
    ].join("\n"),
  );
  const published = JSON.parse(run(process.execPath, ["admin-events.js"], worker).trim());
  assert.equal(published[0]?.[0], "app:resource.orders", "a CommonJS worker did not publish");
  console.log("  require @flowpanel/kit/publish from a CommonJS worker: published");

  await checkCommonJsScript(full);

  const registry = [
    probeFor(subpaths.map((subpath) => `@flowpanel/kit${subpath.slice(1)}`)),
    'import type { ResourceName } from "@flowpanel/kit";',
    'declare module "@flowpanel/kit" {',
    "  interface FlowpanelResources {",
    "    users: { id: string };",
    "  }",
    "}",
    'export const known: ResourceName = "users";',
    "// @ts-expect-error the registry narrows ResourceName to the registered names",
    'export const unknown: ResourceName = "nope";',
    "",
  ].join("\n");
  for (const [file, options] of [
    ["bundler.ts", { module: "esnext", moduleResolution: "bundler", skipLibCheck: true }],
    ["nodenext.mts", { module: "nodenext", moduleResolution: "nodenext", skipLibCheck: true }],
  ]) {
    await typecheck(full, file, registry, options);
    console.log(`  tsc ${options.moduleResolution}, every peer installed: every subpath`);
  }

  const minimal = await consumerWith("minimal", tarball, REQUIRED_PEERS);
  const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
  const allowedEverywhere = new Set([
    ...Object.keys(REQUIRED_PEERS),
    ...Object.keys(installed.dependencies ?? {}),
    "@types/react",
  ]);
  for (const subpath of subpaths) {
    const own = new Set(OWN_PEERS[subpath] ?? []);
    const stray = [...declarationPackages(minimal, subpath)].filter(
      (name) => !builtins.has(name) && !allowedEverywhere.has(name) && !own.has(name),
    );
    assert.deepEqual(stray, [], `the declarations of ${subpath} load ${stray.join(", ")}`);
    if (own.size > 0) continue;
    await typecheck(
      minimal,
      `${subpath.slice(2).replaceAll("/", "-") || "root"}.ts`,
      probeFor([`@flowpanel/kit${subpath.slice(1)}`]),
      { module: "esnext", moduleResolution: "bundler", skipLibCheck: false },
    );
    console.log(`  tsc without optional peers, skipLibCheck off: ${subpath}`);
  }
  console.log(
    `✓ the packed kit installs alone, loads ${subpaths.length} subpaths without Playwright outside ./test, and each subpath type-checks on its own`,
  );
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
