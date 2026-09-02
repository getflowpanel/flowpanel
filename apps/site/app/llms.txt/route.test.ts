import { describe, expect, it } from "vitest";
import { siteConfig } from "@/shared/lib/site-config";
import { source } from "@/shared/lib/source";
import { GET } from "./route";

describe("GET /llms.txt", () => {
  it("lists every canonical documentation page exactly once", async () => {
    const response = GET();
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    for (const page of source.getPages()) {
      const link = `](${siteConfig.url}${page.url})`;
      expect(body.split(link)).toHaveLength(2);
    }
  });
});
