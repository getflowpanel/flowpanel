import { describe, expect, it } from "vitest";
import { tpl } from "../../utils/template.js";

describe("init templates (resolution)", () => {
  it("substitutes DB/SCHEMA/AUTH/APP_NAME into config template", async () => {
    const out = await tpl("flowpanel.config.ts.txt", {
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
});
