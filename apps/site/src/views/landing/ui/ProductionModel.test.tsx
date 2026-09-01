import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Landing } from "../Landing";

describe("Landing production model", () => {
  it("puts concrete production proof before the long product tour", () => {
    const html = renderToStaticMarkup(createElement(Landing));
    const proof = html.indexOf('id="production-model-title"');
    const config = html.indexOf('id="config-title"');

    expect(proof).toBeGreaterThan(-1);
    expect(config).toBeGreaterThan(proof);
    expect(html).toContain("Runs inside your Next.js app");
    expect(html).toContain("No external control plane");
    expect(html).toContain("Server-enforced policy");
    expect(html).toContain("You keep operational control");
    expect(html).toContain('href="/docs/guides/production-readiness"');
    expect(html).toContain('href="/docs/introduction/why-flowpanel"');
    expect(html).toContain('href="/docs/guides/permissions"');
    expect(html).toContain('href="/docs/guides/multi-tenant-scope"');
  });
});
