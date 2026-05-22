import { describe, expect, it } from "vitest";
import { tpl } from "../../utils/template.js";

describe("init templates (resolution)", () => {
  it("substitutes DB/SCHEMA/AUTH/APP_NAME into config template", async () => {
    const out = await tpl("flowpanel.config.drizzle.ts.txt", {
      DB: "@/server/db",
      SCHEMA: "@/server/schema",
      AUTH: "@/server/auth",
      APP_NAME: "Acme",
    });
    expect(out).toContain('import { db } from "@/server/db"');
    expect(out).toContain('import * as schema from "@/server/schema"');
    expect(out).toContain('import { getSession } from "@/server/auth"');
    expect(out).toContain('brand: { name: "Acme" }');
  });

  it("api-route template is static and valid", async () => {
    const out = await tpl("api-route.ts.txt");
    expect(out).toContain('from "flowpanel/next"');
    expect(out).toContain("export const { GET, POST } = handlers(config)");
    expect(out).toContain('runtime = "nodejs"');
  });

  it("sse-route template is static and valid", async () => {
    const out = await tpl("sse-route.ts.txt");
    expect(out).toContain("export const GET = stream(config)");
    expect(out).toContain('dynamic = "force-dynamic"');
  });

  it("app-layout template substitutes APP_NAME + CSS_IMPORT", async () => {
    const out = await tpl("app-layout.tsx.txt", {
      APP_NAME: "Acme",
      CSS_IMPORT: "@/styles/admin.css",
    });
    expect(out).toContain('import "@/styles/admin.css";');
    expect(out).toContain('title: "Acme — Admin"');
    expect(out).toContain('<html lang="en" suppressHydrationWarning>');
  });

  it("tailwind v3 config template exposes the fp-* color map", async () => {
    const out = await tpl("tailwind.config.v3.ts.txt");
    expect(out).toContain('"fp-bg-1"');
    expect(out).toContain('"fp-text-1"');
    expect(out).toContain('"fp-accent"');
    expect(out).toContain("borderRadius:");
    expect(out).toContain('fp: "var(--fp-radius)"');
  });

  it("admin.css.v3 template omits @theme (v4 syntax) and includes v3 directives", async () => {
    const out = await tpl("admin.css.v3.txt");
    expect(out).toContain("@tailwind base;");
    expect(out).toContain("@tailwind components;");
    expect(out).toContain("@tailwind utilities;");
    // The v3 sheet must not contain the v4 `@theme {}` directive at the
    // start of a line. (A `@theme` mention in a comment is fine.)
    expect(out).not.toMatch(/^@theme\b/m);
    expect(out).toContain("--fp-bg-1");
    expect(out).toContain("--fp-radius:");
  });
});
