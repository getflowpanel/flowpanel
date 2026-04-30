import type { ResolvedAdminConfig } from "@flowpanel/core";

export function stream(_config: ResolvedAdminConfig): (req: Request) => Promise<Response> {
  return async function streamGET(_req: Request): Promise<Response> {
    // Minimal SSE — sends one "ready" event. Full broker lands in M3.
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("event: ready\ndata: {}\n\n"));
        controller.close();
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  };
}
