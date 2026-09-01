import { SandboxCapacityError, SandboxCreationRateLimitError } from "./lifecycle";

type SandboxBoundaryFailure = {
  status: 429 | 503;
  code: "demo_capacity" | "demo_creation_rate_limited";
  title: string;
  description: string;
  retryAfter: string;
};

function boundaryFailure(error: unknown): SandboxBoundaryFailure | null {
  if (error instanceof SandboxCapacityError) {
    return {
      status: 503,
      code: "demo_capacity",
      title: "Interactive demo is busy",
      description: "All demo sessions are in use. Please try again soon.",
      retryAfter: "60",
    };
  }
  if (error instanceof SandboxCreationRateLimitError) {
    return {
      status: 429,
      code: "demo_creation_rate_limited",
      title: "Too many new demo sessions",
      description: "Please wait before starting another browser session.",
      retryAfter: "3600",
    };
  }
  return null;
}

export function sandboxBoundaryResponse(request: Request, error: unknown): Response | null {
  const failure = boundaryFailure(error);
  if (!failure) return null;
  const headers = {
    "cache-control": "no-store",
    "retry-after": failure.retryAfter,
  };
  if (new URL(request.url).pathname.startsWith("/api/")) {
    return Response.json({ ok: false, error: failure.code }, { status: failure.status, headers });
  }
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${failure.title}</title></head><body><main><h1>${failure.title}</h1><p>${failure.description}</p><p><a href="">Try again</a></p></main></body></html>`,
    {
      status: failure.status,
      headers: { ...headers, "content-type": "text/html; charset=utf-8" },
    },
  );
}
