import { createHmac, randomUUID } from "node:crypto";

export const DEMO_SANDBOX_COOKIE = "fp_demo_sandbox";
export const DEMO_SANDBOX_HEADER = "x-flowpanel-demo-sandbox";
export const DEMO_FINGERPRINT_HEADER = "x-flowpanel-demo-fingerprint";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isPublicSandboxId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export function resolveSandboxId({
  publicMode,
  cookie,
  generate = randomUUID,
}: {
  publicMode: boolean;
  cookie: string | null;
  generate?: () => string;
}): string {
  if (!publicMode) return "local";
  return isPublicSandboxId(cookie) ? cookie : generate();
}

export function fingerprintClientIp(ip: string | null, secret: string): string {
  return createHmac("sha256", secret)
    .update(ip?.trim() || "unknown")
    .digest("hex");
}

export function trustedClientIp(headers: Headers, trustProxy: boolean): string | null {
  if (!trustProxy) return null;
  const direct = headers.get("x-real-ip")?.trim();
  if (direct) return direct;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export type SandboxCookie = {
  name: typeof DEMO_SANDBOX_COOKIE;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    maxAge: number;
  };
};

/** Pure request binding used by proxy.ts and unit tests. */
export function bindSandboxRequest({
  publicMode,
  cookie,
  headers,
  generate,
  production,
}: {
  publicMode: boolean;
  cookie: string | null;
  headers: Headers;
  generate?: () => string;
  production: boolean;
}): { id: string; headers: Headers; cookie: SandboxCookie | null } {
  const id = resolveSandboxId({
    publicMode,
    cookie,
    ...(generate ? { generate } : {}),
  });
  const boundHeaders = new Headers(headers);
  boundHeaders.set(DEMO_SANDBOX_HEADER, id);
  return {
    id,
    headers: boundHeaders,
    cookie: publicMode
      ? {
          name: DEMO_SANDBOX_COOKIE,
          value: id,
          options: {
            httpOnly: true,
            sameSite: "lax",
            secure: production,
            path: "/",
            maxAge: 24 * 60 * 60,
          },
        }
      : null,
  };
}
