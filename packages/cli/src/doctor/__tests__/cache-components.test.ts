import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminPageSource } from "../../utils/admin-page";
import { inspectProjectCompatibility } from "../../utils/compatibility";
import { usesCacheComponents } from "../../utils/next-config";
import { cacheComponentsChecks } from "../cache-components";

let root: string;
const MOUNT = { path: "/admin", api: "/api/fp" };
const CONFIG = "const nextConfig = { cacheComponents: true };\nexport default nextConfig;\n";
const PAGE = "app/admin/[[...slug]]/page.tsx";
const PAGE_CONFIG = "../../../flowpanel.config";
const LAYOUT =
  'import { headers } from "next/headers";\nexport default async function L() { await headers(); return null; }\n';

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-cache-components-"));
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: {} }));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await fs.writeFile(path.join(root, rel), content);
}

async function checksFor(nextVersion: string) {
  await write("package.json", JSON.stringify({ dependencies: { next: nextVersion } }));
  await write(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version: nextVersion }),
  );
  const { findings } = await inspectProjectCompatibility(root);
  return cacheComponentsChecks(root, findings, "app", MOUNT, "none");
}

describe("cacheComponents", () => {
  it("is read from whichever next.config the project has", async () => {
    expect(await usesCacheComponents(root)).toBe(false);
    await write("next.config.mjs", CONFIG);
    expect(await usesCacheComponents(root)).toBe(true);
    await write("next.config.mjs", "export default { cacheComponents: false };\n");
    expect(await usesCacheComponents(root)).toBe(false);
  });

  it("adds no doctor checks when it is off", async () => {
    expect(await checksFor("16.4.0")).toEqual([]);
  });

  it("needs Next.js 16.3 or newer, the first that reads instant", async () => {
    await write("next.config.ts", CONFIG);
    const [version] = await checksFor("16.2.12");
    expect(version).toMatchObject({ name: "Next.js with cacheComponents", ok: false });
    expect(version?.hint).toContain("Upgrade Next.js to 16.3 or newer");
  });

  it("names every admin file next build would refuse", async () => {
    await write("next.config.ts", CONFIG);
    await write(
      "app/api/fp/[...route]/route.ts",
      'export const GET = 1;\nexport const runtime = "nodejs";\n',
    );
    await write("app/api/fp/stream/route.ts", 'export const dynamic = "force-dynamic";\n');
    await write("app/admin/layout.tsx", LAYOUT);
    const checks = await checksFor("16.4.0");
    expect(checks.map((c) => [c.name, c.ok])).toEqual([
      ["Next.js with cacheComponents", true],
      ["Admin files build under cacheComponents", false],
    ]);
    expect(checks[1]?.hint?.split("\n").map((line) => line.trim())).toEqual([
      "app/api/fp/[...route]/route.ts: remove `export const runtime`",
      "app/api/fp/stream/route.ts: remove `export const dynamic`",
      "app/admin/layout.tsx: add `export const instant = false;`",
    ]);
  });

  it("passes the files init writes", async () => {
    await write("next.config.ts", CONFIG);
    await write("app/api/fp/[...route]/route.ts", "export const GET = 1;\n");
    await write("app/admin/layout.tsx", `export const instant = false;\n\n${LAYOUT}`);
    await write(PAGE, await adminPageSource(PAGE_CONFIG, true));
    expect((await checksFor("16.4.0")).every((c) => c.ok)).toBe(true);
  });

  it("asks the catch-all page for instant = false and restores a generated one with --fix", async () => {
    await write("next.config.ts", CONFIG);
    const before = await adminPageSource(PAGE_CONFIG, false);
    await write(PAGE, before);
    const check = (await checksFor("16.4.0"))[1];
    expect(check).toMatchObject({
      ok: false,
      hint: `${PAGE}: add \`export const instant = false;\``,
    });
    expect(await check?.fix?.()).toEqual([
      {
        path: PAGE,
        content: await adminPageSource(PAGE_CONFIG, true),
        expectedContent: before,
      },
    ]);
  });

  it("removes the segment exports 0.3 route files carry with --fix, and leaves any other form alone", async () => {
    await write("next.config.ts", CONFIG);
    const api = 'export const { GET } = flowpanel.handlers;\nexport const runtime = "nodejs";\n';
    const sse =
      'export const GET = stream(config);\nexport const runtime = "nodejs";\nexport const dynamic = "force-dynamic";\n';
    const own = "export const GET = 1;\nexport const revalidate = compute();\n";
    await write("app/api/fp/[...route]/route.ts", api);
    await write("app/api/fp/stream/route.ts", sse);
    await write("app/admin/not-found.tsx", own);
    await write("app/admin/layout.tsx", `export const instant = false;\n\n${LAYOUT}`);
    await write(PAGE, await adminPageSource(PAGE_CONFIG, true));
    const check = (await checksFor("16.4.0"))[1];
    expect(check?.ok).toBe(false);
    expect(await check?.fix?.()).toEqual([
      {
        path: "app/api/fp/[...route]/route.ts",
        content: "export const { GET } = flowpanel.handlers;\n",
        expectedContent: api,
      },
      {
        path: "app/api/fp/stream/route.ts",
        content: "export const GET = stream(config);\n",
        expectedContent: sse,
      },
    ]);
  });

  it("leaves a catch-all page you edited to you", async () => {
    await write("next.config.ts", CONFIG);
    await write(PAGE, `${await adminPageSource(PAGE_CONFIG, false)}// mine\n`);
    const check = (await checksFor("16.4.0"))[1];
    expect(check?.ok).toBe(false);
    expect(check?.fix).toBeUndefined();
  });
});
