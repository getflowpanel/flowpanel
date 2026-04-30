import type { ResolvedAdminConfig } from "@flowpanel/core";

export function handlers(_config: ResolvedAdminConfig): {
  GET: () => Promise<Response>;
  POST: () => Promise<Response>;
} {
  async function GET(): Promise<Response> {
    return new Response(null, { status: 204 });
  }
  async function POST(): Promise<Response> {
    return new Response("Server Actions are used directly; this endpoint is reserved.", {
      status: 405,
    });
  }
  return { GET, POST };
}
