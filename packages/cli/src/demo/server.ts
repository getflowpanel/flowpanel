import { createServer } from "node:http";
import { handleTrpcRequest, createSSESimulation } from "./mock-router.js";

export function startDemoServer(port: number): Promise<{ close: () => void }> {
  const sse = createSSESimulation();

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (url.pathname.includes("stream.connect")) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const interval = setInterval(() => {
        const event = sse.generateEvent();
        res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
      }, 3000);
      req.on("close", () => clearInterval(interval));
      return;
    }

    if (url.pathname.startsWith("/api/trpc/")) {
      const inputRaw = url.searchParams.get("input");
      let input: Record<string, unknown> = {};
      if (inputRaw) {
        try {
          input = JSON.parse(decodeURIComponent(inputRaw)) as Record<string, unknown>;
        } catch {
          input = {};
        }
      }
      const result = handleTrpcRequest(url.pathname, input);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === "/" || url.pathname === "/admin") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>FlowPanel Demo</title>` +
          `<style>body{font-family:system-ui;background:#0F172A;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}` +
          `.card{background:#1e293b;padding:32px;border-radius:12px;text-align:center;max-width:480px}` +
          `h1{color:#38BDF8;margin-bottom:8px}p{color:#94a3b8;font-size:14px;line-height:1.6}` +
          `code{background:#0f172a;padding:2px 6px;border-radius:4px;font-size:13px}</style></head>` +
          `<body><div class="card"><h1>&#9670; FlowPanel Demo</h1>` +
          `<p>Demo server running on port ${port}.</p>` +
          `<p>API: <code>/api/trpc/*</code> &middot; SSE: <code>/api/trpc/flowpanel.stream.connect</code></p>` +
          `</div></body></html>`,
      );
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ close: () => server.close() });
    });
  });
}
