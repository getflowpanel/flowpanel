import { browserOrigin } from "@flowpanel/kit/next";
import { db } from "@/src/db/client";
import { readSandboxConfig } from "@/src/demo/sandbox/config";
import { DEMO_SANDBOX_HEADER, isPublicSandboxId } from "@/src/demo/sandbox/identity";
import { SandboxResetRateLimitError } from "@/src/demo/sandbox/lifecycle";
import { resetCurrentSandbox } from "@/src/demo/sandbox/service";

const failure = (error: string, status: number) => Response.json({ ok: false, error }, { status });

export async function POST(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (origin !== browserOrigin(req)) return failure("forbidden", 403);
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return failure("forbidden", 403);

  const config = readSandboxConfig();
  if (config.readOnly) return failure("read_only", 403);
  const id = req.headers.get(DEMO_SANDBOX_HEADER);
  const validId = config.publicMode ? isPublicSandboxId(id) : id === "local";
  if (!validId || !id) return failure("forbidden", 403);

  try {
    await resetCurrentSandbox({ db, id, now: new Date() });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof SandboxResetRateLimitError) {
      return failure("reset_rate_limited", 429);
    }
    return failure("reset_failed", 503);
  }
}
