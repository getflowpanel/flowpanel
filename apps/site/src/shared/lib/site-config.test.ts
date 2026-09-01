import { afterEach, describe, expect, it, vi } from "vitest";

describe("siteConfig URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("opens the locally running showcase in development when no public demo URL is configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEMO_URL", "");

    const { siteConfig } = await import("./site-config");

    expect(siteConfig.links.demo).toBe("http://localhost:3000/admin");
  });

  it("keeps the canonical site URL when the build passes an empty NEXT_PUBLIC_SITE_URL", async () => {
    // The Dockerfile declares the ARG, so an unset build arg reaches Next as "".
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    const { siteConfig } = await import("./site-config");

    expect(siteConfig.url).toBe("https://flowpanel.tech");
  });
});
