import { describe, expect, it } from "vitest";
import { siteConfig } from "@/shared/lib/site-config";
import { source } from "@/shared/lib/source";
import { GET } from "./route";

describe("GET /llms-full.txt", () => {
  it("renders every canonical page and expands generated documentation", async () => {
    const response = await GET();
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const lines = body.split("\n");
    for (const page of source.getPages()) {
      const sourceLine = `Source: ${siteConfig.url}${page.url}`;
      expect(
        lines.filter((line) => line === sourceLine),
        page.url,
      ).toHaveLength(1);
    }
    expect(body).toContain("export default defineAdmin");
    expect(body).toContain("flowpanel dev");
    expect(body).not.toMatch(/<(?:include|AutoTypeTable|ApiSignature|CliReference)\b/);
  }, 60_000);
});
