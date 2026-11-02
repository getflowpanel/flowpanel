import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkCreateNextApp } from "./onboarding/create-next-app.mjs";
import {
  assertInstalledFromTarballs,
  fetchFrom,
  packWorkspace,
  run,
  startNext,
  writer,
} from "./onboarding/shared.mjs";

// Build workspace packages before running. The consumer installs package tarballs, never workspace symlinks.
const pm = process.argv[2] ?? "pnpm";
const mode = process.argv[3] ?? "none";
const nextVersion = process.argv[4] ?? (mode === "create-next-app" ? "latest" : "16.4.4");
assert.ok(
  ["npm", "pnpm"].includes(pm) && ["none", "4", "create-next-app"].includes(mode),
  "Usage: check-next-onboarding.mjs [npm|pnpm] [none|4|create-next-app] [next version]",
);
const sandbox = await mkdtemp(path.join(tmpdir(), `flowpanel-next-${pm}-${mode}-${nextVersion}-`));
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
const write = writer(consumer);
const sh = (binary, args, cwd = consumer) => run(binary, args, { cwd, env });
const exists = (file) =>
  access(file, constants.F_OK)
    .then(() => true)
    .catch(() => false);
let server;

async function handWrittenHost(tarballs) {
  const hasTailwind = mode === "4";
  await mkdir(consumer);
  await write(
    "package.json",
    JSON.stringify(
      {
        name: "flowpanel-onboarding-fixture",
        private: true,
        type: "module",
        dependencies: {
          "@flowpanel/kit": tarballs["@flowpanel/kit"],
          "@flowpanel/cli": tarballs["@flowpanel/cli"],
          next: nextVersion,
          react: "19.3.0",
          "react-dom": "19.3.0",
          "drizzle-orm": "0.45.3",
          pg: "8.23.1",
          zod: "4.6.7",
        },
        devDependencies: {
          typescript: "5.9.3",
          "@types/node": "22.20.5",
          "@types/react": "19.3.0",
          "@types/pg": "8.23.1",
          ...(hasTailwind ? { tailwindcss: "4.3.3", "@tailwindcss/postcss": "4.3.3" } : {}),
        },
        ...(pm === "pnpm" ? { pnpm: { overrides: tarballs } } : { overrides: tarballs }),
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
  console.log(`Installing packed packages with ${pm}; Next ${nextVersion}; Tailwind ${mode}`);
  sh(pm, ["install", "--ignore-scripts", ...(pm === "npm" ? ["--no-audit", "--no-fund"] : [])]);
  console.log("Installed tarballs; checking generated files and TypeScript");
  const cli = path.join(consumer, "node_modules/@flowpanel/cli/dist/index.mjs");
  const args = [cli, "init", "--yes", "--json", "--dev-auth"];
  const preview = JSON.parse(sh(process.execPath, [...args, "--dry-run"]));
  assert.equal(preview.applied, false);
  await assert.rejects(readFile(path.join(consumer, "flowpanel.config.ts")));
  const initialized = JSON.parse(sh(process.execPath, args));
  assert.equal(initialized.adminPath, "/flowpanel");
  assert.equal(initialized.authentication, "development");
  await assertInstalledFromTarballs(consumer, tarballs, ["@flowpanel/kit", "@flowpanel/cli"]);
  assert.equal(
    await readFile(path.join(consumer, "src/app/layout.tsx"), "utf8"),
    layout.replace('<html lang="en">', '<html lang="en" suppressHydrationWarning>'),
  );
  assert.equal(
    await readFile(path.join(consumer, "src/app/(dashboard)/admin/page.tsx"), "utf8"),
    legacy,
  );
  for (const file of [
    "src/app/flowpanel/[[...slug]]/page.tsx",
    "src/app/flowpanel/not-found.tsx",
  ]) {
    assert.ok(initialized.files.applied.includes(file), `init did not write ${file}`);
  }
  assert.match(
    await readFile(path.join(consumer, "src/app/flowpanel/[[...slug]]/page.tsx"), "utf8"),
    /export const generateMetadata = flowpanel\.metadata;/,
  );
  assert.match(
    await readFile(path.join(consumer, "src/app/flowpanel/not-found.tsx"), "utf8"),
    /export default flowpanel\.notFound;/,
  );
  for (const file of ["layout.tsx", "[[...slug]]/page.tsx"]) {
    assert.doesNotMatch(
      await readFile(path.join(consumer, "src/app/flowpanel", file), "utf8"),
      /instant/,
    );
  }
  const repeated = JSON.parse(sh(process.execPath, args));
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
  sh(process.execPath, [path.join(consumer, "node_modules/typescript/bin/tsc"), "--noEmit"]);
  const installedNext = JSON.parse(
    await readFile(path.join(consumer, "node_modules/next/package.json"), "utf8"),
  ).version;
  console.log(`Starting Next ${installedNext} and requesting host/admin routes`);
  server = await startNext(
    consumer,
    "dev",
    Number(installedNext.split(".")[0]) >= 16 ? ["--webpack"] : [],
    env,
  );
  let adminHtml = "";
  for (const [route, content] of [
    ["/", "Existing host home"],
    ["/admin", "Existing host admin"],
    ["/ru", "Existing locale page"],
    ["/order/1", "Existing order page"],
    ["/flowpanel", "FlowPanel is mounted"],
  ]) {
    const response = await fetchFrom(server.origin, route);
    assert.equal(response.status, 200, `${route}\n${server.log()}`);
    const html = await response.text();
    assert.ok(html.includes(content), `${route} did not render expected content\n${server.log()}`);
    if (route === "/flowpanel") adminHtml = html;
  }
  const unknownAdminPage = await fetchFrom(server.origin, "/flowpanel/nope");
  assert.equal(unknownAdminPage.status, 404, `/flowpanel/nope\n${server.log()}`);
  const stylesheetUrls = [
    ...adminHtml.matchAll(/<link\b[^>]*\bhref="([^"]+\.css[^"]*)"[^>]*>/g),
  ].map((match) => match[1].replaceAll("&amp;", "&"));
  assert.ok(stylesheetUrls.length > 0, `FlowPanel route served no stylesheet\n${server.log()}`);
  const servedCss = await Promise.all(
    stylesheetUrls.map(async (href) => {
      const url = new URL(href, server.origin);
      const response = await fetchFrom(server.origin, `${url.pathname}${url.search}`);
      assert.equal(response.status, 200, `Stylesheet ${href} did not load\n${server.log()}`);
      return response.text();
    }),
  );
  assert.ok(
    servedCss.some((css) => css.includes("--fp-bg-1") && css.includes("data-flowpanel-root")),
    `FlowPanel stylesheet was not served from the packed kit export\n${server.log()}`,
  );
  console.log(
    `✓ ${pm}, Next ${installedNext}, Tailwind ${mode}: dry-run, init, resolved packed CSS, TypeScript, host routes, 404 and served admin CSS passed`,
  );
}

try {
  const tarballs = await packWorkspace(sandbox, env);
  if (mode === "create-next-app") {
    await checkCreateNextApp({ pm, nextVersion, sandbox, consumer, env, tarballs });
  } else {
    await handWrittenHost(tarballs);
  }
} catch (error) {
  if (server) console.error(server.log());
  throw error;
} finally {
  await server?.stop();
  if (process.env.FLOWPANEL_KEEP_FIXTURE === "1") {
    if (server) await writeFile(path.join(sandbox, "server.log"), server.log());
    console.log(`Kept fixture: ${consumer}`);
  } else await rm(sandbox, { recursive: true, force: true });
}
