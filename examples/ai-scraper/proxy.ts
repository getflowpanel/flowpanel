import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "./src/db/client";
import { readSandboxConfig } from "./src/demo/sandbox/config";
import {
  bindSandboxRequest,
  DEMO_FINGERPRINT_HEADER,
  DEMO_SANDBOX_COOKIE,
  fingerprintClientIp,
  trustedClientIp,
} from "./src/demo/sandbox/identity";
import { sandboxBoundaryResponse } from "./src/demo/sandbox/request-boundary";
import { ensureSandbox } from "./src/demo/sandbox/service";

export async function proxy(request: NextRequest) {
  const config = readSandboxConfig();
  const binding = bindSandboxRequest({
    publicMode: config.publicMode,
    cookie: request.cookies.get(DEMO_SANDBOX_COOKIE)?.value ?? null,
    headers: request.headers,
    production: process.env.NODE_ENV === "production",
  });

  if (config.publicMode && config.secret) {
    binding.headers.set(
      DEMO_FINGERPRINT_HEADER,
      fingerprintClientIp(trustedClientIp(request.headers, config.trustProxy), config.secret),
    );
  } else {
    binding.headers.delete(DEMO_FINGERPRINT_HEADER);
  }

  try {
    await ensureSandbox({
      db,
      id: binding.id,
      fingerprintHash: binding.headers.get(DEMO_FINGERPRINT_HEADER),
      now: new Date(),
      config,
    });
  } catch (error) {
    const response = sandboxBoundaryResponse(request, error);
    if (response) return response;
    throw error;
  }

  const response = NextResponse.next({ request: { headers: binding.headers } });
  if (binding.cookie) {
    response.cookies.set(binding.cookie.name, binding.cookie.value, binding.cookie.options);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/flowpanel/:path*", "/api/demo/:path*"],
};
