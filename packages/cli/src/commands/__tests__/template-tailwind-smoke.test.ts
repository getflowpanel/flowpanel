import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { tpl } from "../../utils/template";

// Each case boots a real Tailwind compiler over a fresh fixture tree.
vi.setConfig({ testTimeout: 60_000 });

const require_ = createRequire(import.meta.url);

type Processor = { process(css: string, opts: { from: string }): Promise<{ css: string }> };
const postcss = require_("postcss") as (plugins: unknown[]) => Processor;
const tailwindV4 = require_("@tailwindcss/postcss") as (opts: { base: string }) => unknown;
const tailwindV3 = require_("tailwindcss3") as (config: unknown) => unknown;

const TAILWIND_V4_DIR = path.dirname(require_.resolve("tailwindcss/package.json"));

/** Classes only present in the fake package output, never in the templates. */
const MARKERS = 'const cn = "bg-fp-bg-1 rounded-fp shadow-fp-sm text-fp-chart-1";\n';

const roots: string[] = [];

afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

/**
 * A throwaway app root outside the monorepo, so nothing but the fixture's own
 * files can satisfy the assertions.
 */
function appRoot(layout: "hoisted" | "pnpm" | "empty"): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fp-tw-")));
  roots.push(dir);
  fs.mkdirSync(path.join(dir, "node_modules"), { recursive: true });
  fs.symlinkSync(TAILWIND_V4_DIR, path.join(dir, "node_modules/tailwindcss"));
  write(path.join(dir, "app/page.tsx"), 'export default () => <main className="p-4" />;\n');

  if (layout === "hoisted") {
    write(path.join(dir, "node_modules/@flowpanel/react/dist/_atoms/Badge.mjs"), MARKERS);
    write(path.join(dir, "node_modules/@flowpanel/kit/dist/react.js"), 'export * from "x";\n');
  }
  if (layout === "pnpm") {
    const store = path.join(dir, "node_modules/.pnpm");
    write(
      path.join(
        store,
        "@flowpanel+react@0.1.0/node_modules/@flowpanel/react/dist/_atoms/Badge.mjs",
      ),
      MARKERS,
    );
    write(
      path.join(store, "@flowpanel+kit@0.1.0/node_modules/@flowpanel/kit/dist/react.js"),
      'export * from "x";\n',
    );
    fs.mkdirSync(path.join(store, "node_modules/@flowpanel"), { recursive: true });
    fs.symlinkSync(
      "../../@flowpanel+react@0.1.0/node_modules/@flowpanel/react",
      path.join(store, "node_modules/@flowpanel/react"),
    );
    fs.mkdirSync(path.join(dir, "node_modules/@flowpanel"), { recursive: true });
    fs.symlinkSync(
      "../.pnpm/@flowpanel+kit@0.1.0/node_modules/@flowpanel/kit",
      path.join(dir, "node_modules/@flowpanel/kit"),
    );
  }
  return dir;
}

async function buildV4(root: string, css: string): Promise<string> {
  const cssPath = path.join(root, "styles/admin.css");
  write(cssPath, css);
  const out = await postcss([tailwindV4({ base: root })]).process(css, { from: cssPath });
  return out.css;
}

async function buildV3(root: string): Promise<string> {
  const configPath = path.join(root, "tailwind.config.ts");
  write(configPath, await tpl("tailwind.config.v3.ts.txt"));
  const { createJiti } = await import("jiti");
  const config = (await createJiti(configPath).import(configPath, { default: true })) as {
    content: string[];
  };
  // v3 resolves relative `content` globs against process.cwd(); anchor them to
  // the fixture instead of chdir-ing the worker.
  const content = config.content.map((glob) => path.join(root, glob.replace(/^\.\//, "")));

  const cssPath = path.join(root, "styles/admin.css");
  const css = await tpl("admin.css.v3.txt");
  write(cssPath, css);
  const out = await postcss([tailwindV3({ ...config, content })]).process(css, { from: cssPath });
  return out.css;
}

describe("scaffolded stylesheet compiles through real Tailwind", () => {
  it("v4: emits fp-* utilities for a hoisted (npm/yarn/bun) install", async () => {
    const css = await buildV4(appRoot("hoisted"), await tpl("admin.css.txt", { SOURCE_UP: "../" }));
    expect(css).toContain(".bg-fp-bg-1");
    expect(css).toContain(".rounded-fp");
    expect(css).toContain(".shadow-fp-sm");
    expect(css).toContain(".text-fp-chart-1");
  });

  it("v4: emits fp-* utilities for a pnpm isolated install", async () => {
    const css = await buildV4(appRoot("pnpm"), await tpl("admin.css.txt", { SOURCE_UP: "../" }));
    expect(css).toContain(".bg-fp-bg-1");
    expect(css).toContain(".rounded-fp");
  });

  it("v4: emits nothing without the Tailwind import", async () => {
    const template = await tpl("admin.css.txt", { SOURCE_UP: "../" });
    expect(template).toContain('@import "tailwindcss";');
    const css = await buildV4(appRoot("hoisted"), template.replace('@import "tailwindcss";\n', ""));
    expect(css).not.toContain(".bg-fp-bg-1");
    expect(css).not.toContain("@theme");
  });

  it("v4: emits no fp-* utilities when the packages are missing (the @source lines carry them)", async () => {
    const css = await buildV4(appRoot("empty"), await tpl("admin.css.txt", { SOURCE_UP: "../" }));
    expect(css).not.toContain(".bg-fp-bg-1");
    expect(css).not.toContain(".rounded-fp");
  });

  it("v4: @source depth follows the src/styles/ scaffold layout", async () => {
    const root = appRoot("hoisted");
    const css = await tpl("admin.css.txt", { SOURCE_UP: "../../" });
    const cssPath = path.join(root, "src/styles/admin.css");
    write(cssPath, css);
    const out = await postcss([tailwindV4({ base: root })]).process(css, { from: cssPath });
    expect(out.css).toContain(".bg-fp-bg-1");
  });

  it("v3: emits fp-* utilities for a hoisted install", async () => {
    const css = await buildV3(appRoot("hoisted"));
    expect(css).toContain(".bg-fp-bg-1");
    expect(css).toContain(".rounded-fp");
    expect(css).toContain(".shadow-fp-sm");
  });

  it("v3: emits fp-* utilities for a pnpm isolated install", async () => {
    const css = await buildV3(appRoot("pnpm"));
    expect(css).toContain(".bg-fp-bg-1");
    expect(css).toContain(".rounded-fp");
  });

  it("v3: emits no fp-* utilities when the packages are missing", async () => {
    const css = await buildV3(appRoot("empty"));
    expect(css).not.toContain(".bg-fp-bg-1");
    expect(css).not.toContain(".rounded-fp");
  });
});
