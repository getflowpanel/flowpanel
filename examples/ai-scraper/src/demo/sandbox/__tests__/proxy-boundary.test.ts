import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_FINGERPRINT_HEADER, DEMO_SANDBOX_HEADER } from "../identity";
import { SandboxCapacityError, SandboxCreationRateLimitError } from "../lifecycle";

const ensureSandbox = vi.hoisted(() => vi.fn());

vi.mock("../../../db/client", () => ({ db: {} }));
vi.mock("../service", () => ({ ensureSandbox }));

import { proxy } from "../../../../proxy";
import { getDemoSession } from "../../auth/session";

const SANDBOX_ID = "9f34ca6a-a3de-4ac1-a8b4-61bd83fa5174";
const FINGERPRINT = "a".repeat(64);

function request(pathname: string): NextRequest {
  return new NextRequest(`http://demo.test${pathname}`, {
    headers: {
      cookie: `fp_demo_sandbox=${SANDBOX_ID}`,
      "x-real-ip": "203.0.113.8",
    },
  });
}

describe("demo sandbox request boundary", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("DEMO_TRUST_PROXY", "true");
    vi.stubEnv("DEMO_SANDBOX_SECRET", "test-secret-that-is-longer-than-32-characters");
    ensureSandbox.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    {
      error: new SandboxCapacityError("database details must stay private"),
      status: 503,
      code: "demo_capacity",
      title: "Interactive demo is busy",
    },
    {
      error: new SandboxCreationRateLimitError("fingerprint details must stay private"),
      status: 429,
      code: "demo_creation_rate_limited",
      title: "Too many new demo sessions",
    },
  ])("maps $code at both page and API boundaries", async ({ error, status, code, title }) => {
    ensureSandbox.mockRejectedValue(error);

    const pageResponse = await proxy(request("/admin/products"));
    expect(pageResponse.status).toBe(status);
    expect(pageResponse.headers.get("content-type")).toContain("text/html");
    expect(pageResponse.headers.get("cache-control")).toBe("no-store");
    const html = await pageResponse.text();
    expect(html).toContain(title);
    expect(html).not.toContain(error.message);

    const apiResponse = await proxy(request("/api/flowpanel/products"));
    expect(apiResponse.status).toBe(status);
    expect(apiResponse.headers.get("content-type")).toContain("application/json");
    expect(apiResponse.headers.get("cache-control")).toBe("no-store");
    expect(await apiResponse.json()).toEqual({ ok: false, error: code });
  });

  it("provisions once at the proxy boundary instead of repeating work in auth", async () => {
    ensureSandbox.mockResolvedValue(undefined);
    const response = await proxy(request("/admin/products"));
    expect(response.status).toBe(200);
    expect(ensureSandbox).toHaveBeenCalledTimes(1);

    const boundRequest = new Request("http://demo.test/admin/products", {
      headers: {
        [DEMO_SANDBOX_HEADER]: SANDBOX_ID,
        [DEMO_FINGERPRINT_HEADER]: FINGERPRINT,
      },
    });
    await expect(getDemoSession(boundRequest)).resolves.toMatchObject({ sandboxId: SANDBOX_ID });
    expect(ensureSandbox).toHaveBeenCalledTimes(1);
  });
});
