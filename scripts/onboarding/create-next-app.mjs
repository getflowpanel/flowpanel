import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { assertInstalledFromTarballs, fetchFrom, run, startNext, writer } from "./shared.mjs";

const SCHEMA = `import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
`;
const DB = `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
`;
const AUTH = `type Session = { user: { id: string; role: string } };

export async function getSession(req: Request): Promise<Session | null> {
  const id = req.headers.get("x-fixture-user");
  return id ? { user: { id, role: "admin" } } : null;
}
`;
const REJECTED_UNDER_CACHE_COMPONENTS = /^export const (runtime|dynamic|revalidate|fetchCache)\b/m;

async function withDatabase(adminUrl, consumer, work) {
  const { Client } = createRequire(path.join(consumer, "package.json"))("pg");
  const name = `fp_onboarding_${randomBytes(4).toString("hex")}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  try {
    const app = new Client({ connectionString: url.href });
    await app.connect();
    await app.query(
      "create table users (id uuid primary key default gen_random_uuid(), email text not null, name text, created_at timestamp not null default now())",
    );
    await app.end();
    return await work(url.href);
  } finally {
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  }
}

/** A default `create-next-app` project, init and new from the packed CLI, then a production build that creates records. */
export async function checkCreateNextApp({ pm, nextVersion, sandbox, consumer, env, tarballs }) {
  const adminUrl = process.env.FLOWPANEL_ONBOARDING_DATABASE_URL;
  assert.ok(
    adminUrl,
    "create-next-app mode needs FLOWPANEL_ONBOARDING_DATABASE_URL, a Postgres URL whose user may create databases",
  );
  console.log(`Creating a default create-next-app@${nextVersion} project with ${pm}`);
  run(
    "npx",
    [
      "--yes",
      `create-next-app@${nextVersion}`,
      "consumer",
      "--yes",
      `--use-${pm}`,
      "--skip-install",
      "--disable-git",
    ],
    { cwd: sandbox, env },
  );
  const write = writer(consumer);
  const sh = (binary, args, extraEnv = {}) =>
    run(binary, args, { cwd: consumer, env: { ...env, ...extraEnv } });
  const manifest = JSON.parse(await readFile(path.join(consumer, "package.json"), "utf8"));
  manifest.dependencies = {
    ...manifest.dependencies,
    "@flowpanel/kit": tarballs["@flowpanel/kit"],
    "drizzle-orm": "0.45.3",
    pg: "8.23.1",
  };
  manifest.devDependencies = {
    ...manifest.devDependencies,
    "@flowpanel/cli": tarballs["@flowpanel/cli"],
    "@types/pg": "8.23.1",
  };
  if (pm === "pnpm") manifest.pnpm = { ...manifest.pnpm, overrides: tarballs };
  else manifest.overrides = tarballs;
  await writeFile(path.join(consumer, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const hasWorkspaceFile = await access(path.join(consumer, "pnpm-workspace.yaml"), constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (pm === "pnpm" && !hasWorkspaceFile) await write("pnpm-workspace.yaml", "packages: []\n");
  const base = await access(path.join(consumer, "src/app"), constants.F_OK)
    .then(() => "src/")
    .catch(() => "");
  await write(`${base}db/schema.ts`, SCHEMA);
  await write(`${base}db/index.ts`, DB);
  await write(`${base}lib/auth.ts`, AUTH);
  sh(pm, ["install", "--ignore-scripts", ...(pm === "npm" ? ["--no-audit", "--no-fund"] : [])]);

  const installedNext = JSON.parse(
    await readFile(path.join(consumer, "node_modules/next/package.json"), "utf8"),
  ).version;
  const nextConfig = await readFile(path.join(consumer, "next.config.ts"), "utf8");
  const cacheComponents = /\bcacheComponents\s*:\s*true\b/.test(nextConfig);
  console.log(`Next ${installedNext}, cacheComponents ${cacheComponents ? "on" : "off"}`);

  const cli = path.join(consumer, "node_modules/@flowpanel/cli/dist/index.mjs");
  const initialized = JSON.parse(
    sh(process.execPath, [
      cli,
      "init",
      "--yes",
      "--json",
      "--db",
      "@/db",
      "--schema",
      "@/db/schema",
      "--auth",
      "@/lib/auth",
    ]),
  );
  assert.equal(initialized.adminPath, "/admin");
  await assertInstalledFromTarballs(consumer, tarballs, ["@flowpanel/kit", "@flowpanel/cli"]);
  const appDir = `${base}app`;
  for (const file of [
    `${appDir}/api/flowpanel/[...route]/route.ts`,
    `${appDir}/api/flowpanel/stream/route.ts`,
  ]) {
    assert.doesNotMatch(
      await readFile(path.join(consumer, file), "utf8"),
      REJECTED_UNDER_CACHE_COMPONENTS,
    );
  }
  const layout = await readFile(path.join(consumer, `${appDir}/admin/layout.tsx`), "utf8");
  assert.equal(/^export const instant = false;$/m.test(layout), cacheComponents, layout);
  const page = await readFile(path.join(consumer, `${appDir}/admin/[[...slug]]/page.tsx`), "utf8");
  assert.equal(/^export const instant = false;$/m.test(page), cacheComponents, page);
  const added = JSON.parse(sh(process.execPath, [cli, "new", "users", "--json"]));
  assert.equal(added.applied, true);

  await withDatabase(adminUrl, consumer, async (databaseUrl) => {
    const prodEnv = { ...env, NODE_ENV: "production", DATABASE_URL: databaseUrl };
    sh(process.execPath, [cli, "migrate"], prodEnv);
    const doctor = JSON.parse(sh(process.execPath, [cli, "doctor", "--json"], prodEnv));
    assert.ok(doctor.ok, JSON.stringify(doctor.checks.filter((check) => !check.ok)));
    console.log("init, new, migrate and doctor passed; running the app's production build");
    sh(pm, ["run", "build"], prodEnv);
    const server = await startNext(consumer, "start", [], prodEnv);
    try {
      await exercise(server, cacheComponents);
    } catch (error) {
      console.error(server.log());
      throw error;
    } finally {
      await server.stop();
    }
  });
  console.log(
    `✓ create-next-app@${nextVersion} (Next ${installedNext}, cacheComponents ${cacheComponents ? "on" : "off"}), ${pm}: init, new, migrate, doctor, next build, sign-in wall, records created through the API and the form route, list page and 404 passed`,
  );
}

async function exercise(server, cacheComponents) {
  const asAdmin = { "x-fixture-user": "fixture-admin" };
  const page = async (route, headers = asAdmin) => {
    const response = await fetchFrom(server.origin, route, { headers });
    return { status: response.status, html: await response.text() };
  };
  assert.equal((await page("/", {})).status, 200);
  const wall = await page("/admin", {});
  assert.equal(wall.status, 200);
  assert.match(wall.html, /Sign in required/);
  const admin = await page("/admin");
  assert.equal(admin.status, 200);
  assert.match(admin.html, /Users/);

  const api = `${server.origin}/api/flowpanel`;
  const json = await fetch(`${api}/users`, {
    method: "POST",
    headers: { ...asAdmin, "content-type": "application/json", origin: server.origin },
    body: JSON.stringify({ email: "ann@example.com", name: "Ann" }),
  });
  assert.equal(json.status, 200, await json.clone().text());
  assert.equal((await json.json()).ok, true);
  const form = new FormData();
  form.set("email", "bob@example.com");
  form.set("name", "Bob");
  const posted = await fetch(`${api}/users/create`, {
    method: "POST",
    headers: { ...asAdmin, origin: server.origin },
    body: form,
  });
  assert.equal(posted.status, 200, await posted.clone().text());
  assert.equal((await posted.json()).ok, true);
  const listed = await (await fetch(`${api}/users`, { headers: asAdmin })).json();
  assert.equal(listed.data.total, 2);

  const list = await page("/admin/users");
  assert.equal(list.status, 200);
  assert.match(list.html, /bob@example\.com/);
  const bob = listed.data.rows.find((row) => row.email === "bob@example.com");
  assert.ok(list.html.includes(`/admin/users/${bob.id}`), "a list row opens its record page");
  const missing = await page("/admin/nope");
  assert.match(missing.html, /<title>Page not found<\/title>/);
  assert.doesNotMatch(missing.html, /<title>Create Next App<\/title>/);
  assert.match(missing.html, /<meta name="robots" content="noindex/);
  // Under cacheComponents Next streams the admin after the host's static shell, so the status is already 200.
  if (!cacheComponents) assert.equal(missing.status, 404);
  assert.equal((await page("/", {})).status, 200);
  assert.doesNotMatch(server.log(), /\bError\b/);
}
