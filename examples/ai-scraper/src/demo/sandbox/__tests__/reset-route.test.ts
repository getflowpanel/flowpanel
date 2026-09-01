import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../service", async () => {
  const actual = await vi.importActual<typeof import("../service")>("../service");
  return { ...actual, resetCurrentSandbox: vi.fn() };
});

import { POST } from "../../../../app/api/demo/reset/route";
import { DEMO_SANDBOX_HEADER } from "../identity";
import { SandboxResetRateLimitError } from "../lifecycle";
import { resetCurrentSandbox } from "../service";

function request(headers: Record<string, string> = {}, body?: unknown) {
  return new Request("http://demo.test/api/demo/reset", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("POST /api/demo/reset", () => {
  beforeEach(() => vi.mocked(resetCurrentSandbox).mockReset());

  it.each([
    [{}, 403],
    [{ origin: "https://attacker.test", [DEMO_SANDBOX_HEADER]: "local" }, 403],
    [{ origin: "http://demo.test" }, 403],
    [
      {
        origin: "http://demo.test",
        "sec-fetch-site": "cross-site",
        [DEMO_SANDBOX_HEADER]: "local",
      },
      403,
    ],
  ] as const)("rejects an unbound or cross-origin request", async (headers, status) => {
    const response = await POST(request(headers));
    expect(response.status).toBe(status);
    expect(resetCurrentSandbox).not.toHaveBeenCalled();
  });

  it("ignores caller-supplied sandbox ids and resets only the proxy-bound id", async () => {
    const response = await POST(
      request(
        { origin: "http://demo.test", [DEMO_SANDBOX_HEADER]: "local" },
        { sandboxId: "9f34ca6a-a3de-4ac1-a8b4-61bd83fa5174" },
      ),
    );
    expect(response.status).toBe(200);
    expect(resetCurrentSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ id: "local", now: expect.any(Date) }),
    );
  });

  it("maps the database-backed reset cooldown to 429", async () => {
    vi.mocked(resetCurrentSandbox).mockRejectedValueOnce(
      new SandboxResetRateLimitError("cooldown"),
    );
    const response = await POST(
      request({ origin: "http://demo.test", [DEMO_SANDBOX_HEADER]: "local" }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ ok: false, error: "reset_rate_limited" });
  });
});
