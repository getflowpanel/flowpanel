import { afterEach, describe, expect, it, vi } from "vitest";

describe("siteConfig demo URL", () => {
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
});
