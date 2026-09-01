import { describe, expect, it, vi } from "vitest";
import {
  bindSandboxRequest,
  DEMO_SANDBOX_COOKIE,
  DEMO_SANDBOX_HEADER,
  fingerprintClientIp,
  resolveSandboxId,
  trustedClientIp,
} from "../identity";

const UUID_A = "9f34ca6a-a3de-4ac1-a8b4-61bd83fa5174";
const UUID_B = "49b90787-c953-4226-98e0-fd7ac47d112c";
const SECRET = "sandbox-secret-that-is-at-least-32-chars";

describe("demo sandbox identity", () => {
  it("uses the stable local id outside public mode", () => {
    expect(resolveSandboxId({ publicMode: false, cookie: null, generate: vi.fn() })).toBe("local");
  });

  it("accepts only canonical v4 UUID cookies in public mode", () => {
    const generate = vi.fn(() => UUID_B);
    expect(resolveSandboxId({ publicMode: true, cookie: UUID_A, generate })).toBe(UUID_A);
    expect(resolveSandboxId({ publicMode: true, cookie: "forged", generate })).toBe(UUID_B);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("creates deterministic non-reversible fingerprints including the unknown bucket", () => {
    expect(fingerprintClientIp(null, SECRET)).toBe(fingerprintClientIp(null, SECRET));
    const fingerprint = fingerprintClientIp("203.0.113.8", SECRET);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("203.0.113.8");
  });

  it("ignores forwarding headers unless the deployment explicitly trusts its proxy", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.8",
      "x-forwarded-for": "198.51.100.4, 10.0.0.2",
    });

    expect(trustedClientIp(headers, false)).toBeNull();
    expect(trustedClientIp(headers, true)).toBe("203.0.113.8");
    headers.delete("x-real-ip");
    expect(trustedClientIp(headers, true)).toBe("198.51.100.4");
  });

  it("overwrites forged internal headers and describes a secure public cookie", () => {
    const headers = new Headers({ [DEMO_SANDBOX_HEADER]: "attacker-controlled" });
    const binding = bindSandboxRequest({
      publicMode: true,
      cookie: null,
      headers,
      generate: () => UUID_A,
      production: true,
    });

    expect(binding.headers.get(DEMO_SANDBOX_HEADER)).toBe(UUID_A);
    expect(binding.cookie).toEqual({
      name: DEMO_SANDBOX_COOKIE,
      value: UUID_A,
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 24 * 60 * 60,
      },
    });
  });
});
